import { DurableObject } from "cloudflare:workers";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...headers }
});
const id = () => crypto.randomUUID();
const enc = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const randomToken = (bytes = 32) => {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return hex(value);
};
const sha256 = async (value) => hex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
const now = () => new Date().toISOString();
const addMinutes = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();
const parseBody = async (request) => {
  try { return await request.json(); } catch { return null; }
};
const allowedOrigins = new Set([
  "https://gradly-peach.vercel.app",
  "https://gradly-v2.vercel.app",
  "http://localhost:5173"
]);
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://gradly-peach.vercel.app",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}
function reply(request, data, status = 200) { return json(data, status, corsHeaders(request)); }
function fail(request, message, status = 400) { return reply(request, { success: false, error: message }, status); }

async function passwordHash(password, saltHex) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g).map((x) => parseInt(x, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, key, 256);
  return { hash: hex(bits), salt: hex(salt) };
}
async function currentUser(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const tokenHash = await sha256(token);
  return env.DB.prepare(`
    SELECT u.id,u.email,u.display_name,u.status,u.institution_name,u.branch_name,u.semester,
           s.id AS session_id
    FROM chat_sessions s JOIN chat_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(tokenHash, now()).first();
}
async function requireMember(env, groupId, userId) {
  return env.DB.prepare(`
    SELECT m.role,m.status,g.status AS group_status,g.visibility
    FROM chat_group_members m JOIN chat_groups g ON g.id=m.group_id
    WHERE m.group_id=? AND m.user_id=? AND m.status='active' AND g.status='active'
  `).bind(groupId, userId).first();
}
async function isPlatformAdmin(env, userId) {
  return env.DB.prepare("SELECT role FROM chat_platform_roles WHERE user_id=? ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END LIMIT 1").bind(userId).first();
}
async function audit(env, actorId, action, targetType, targetId, reason = "", metadata = {}) {
  await env.DB.prepare(`
    INSERT INTO chat_audit_logs(id,actor_id,action,target_type,target_id,reason,metadata_json)
    VALUES(?,?,?,?,?,?,?)
  `).bind(id(), actorId || null, action, targetType, targetId || null, reason, JSON.stringify(metadata)).run();
}
async function sendVerificationEmail(env, email, displayName, token) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Email verification is not configured. Add RESEND_API_KEY and EMAIL_FROM Worker secrets.");
  const base = env.COMMUNITY_APP_URL || "https://gradly-peach.vercel.app";
  const link = base.replace(/\/$/, "") + "/community/verify?token=" + encodeURIComponent(token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "authorization": "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Verify your Gradly Communities email",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#171717"><h2>Welcome to Gradly Communities, ${escapeHtml(displayName)}.</h2><p>Verify your email address to join study groups and chat with classmates.</p><p><a href="${link}" style="display:inline-block;background:#171717;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Verify email address</a></p><p>This link expires in 30 minutes. If you did not create this account, you can ignore this email.</p></div>`
    })
  });
  if (!response.ok) throw new Error("Email provider rejected the verification email (" + response.status + ").");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
}

export class ChatRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket upgrade", { status: 426 });
    const userId = request.headers.get("x-chat-user");
    const groupId = request.headers.get("x-chat-group");
    if (!userId || !groupId) return new Response("Unauthorized", { status: 401 });
    const member = await requireMember(this.env, groupId, userId);
    if (!member) return new Response("Group membership required", { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ userId, groupId });
    this.ctx.acceptWebSocket(server, ["group:" + groupId]);
    server.send(JSON.stringify({ type: "connected", groupId }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const attachment = ws.deserializeAttachment();
    if (!attachment || typeof message !== "string" || message.length > 6000) return;
    let data;
    try { data = JSON.parse(message); } catch { return; }
    if (data.type !== "message") return;
    const body = typeof data.body === "string" ? data.body.trim() : "";
    if (!body || body.length > 5000) {
      ws.send(JSON.stringify({ type: "error", error: "Messages must contain 1–5000 characters." }));
      return;
    }
    const { userId, groupId } = attachment;
    const member = await requireMember(this.env, groupId, userId);
    if (!member) { ws.close(1008, "Membership is no longer active"); return; }
    const rate = await this.env.DB.prepare(`
      SELECT COUNT(*) AS total FROM chat_messages
      WHERE sender_id=? AND created_at>=?
    `).bind(userId, new Date(Date.now() - 60_000).toISOString()).first();
    if ((rate?.total || 0) >= 10) {
      ws.send(JSON.stringify({ type: "error", error: "Message limit reached. Please wait a moment." }));
      return;
    }
    const messageId = id();
    await this.env.DB.prepare(`
      INSERT INTO chat_messages(id,group_id,sender_id,body,reply_to_id)
      VALUES(?,?,?,?,?)
    `).bind(messageId, groupId, userId, body, data.replyToId || null).run();
    const saved = await this.env.DB.prepare(`
      SELECT m.id,m.group_id,m.sender_id,m.body,m.reply_to_id,m.edited_at,m.created_at,
             u.display_name AS sender_name
      FROM chat_messages m JOIN chat_users u ON u.id=m.sender_id WHERE m.id=?
    `).bind(messageId).first();
    const event = JSON.stringify({ type: "message", message: saved });
    for (const socket of this.ctx.getWebSockets(["group:" + groupId])) {
      if (socket.readyState === WebSocket.OPEN) {
        try { socket.send(event); } catch {}
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    ws.close(code, reason);
  }
  async webSocketError(ws) {
    try { ws.close(1011, "Connection error"); } catch {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (path === "/health") {
      try {
        const result = await env.DB.prepare("SELECT COUNT(*) AS tables FROM sqlite_master WHERE type='table' AND name LIKE 'chat_%'").first();
        return reply(request, { success: true, service: "Gradly Communities API", database: "connected", communityTables: result?.tables || 0 });
      } catch (error) { return fail(request, "Database connection failed: " + error.message, 500); }
    }

    try {
      if (path === "/auth/register" && request.method === "POST") {
        const body = await parseBody(request);
        const email = String(body?.email || "").trim().toLowerCase();
        const displayName = String(body?.displayName || "").trim();
        const password = String(body?.password || "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail(request, "Enter a valid email address.");
        if (displayName.length < 2 || displayName.length > 60) return fail(request, "Name must be 2–60 characters.");
        if (password.length < 10 || password.length > 128) return fail(request, "Password must be 10–128 characters.");
        if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return fail(request, "Email verification is not configured yet. The platform administrator must configure the email provider.", 503);
        const existing = await env.DB.prepare("SELECT id,email_verified_at FROM chat_users WHERE email=?").bind(email).first();
        if (existing?.email_verified_at) return fail(request, "An account already exists for this email. Please sign in.", 409);
        const userId = existing?.id || id();
        const passwordData = await passwordHash(password);
        if (existing) {
          await env.DB.prepare("UPDATE chat_users SET display_name=?,password_hash=?,password_salt=?,updated_at=? WHERE id=?")
            .bind(displayName, passwordData.hash, passwordData.salt, now(), userId).run();
          await env.DB.prepare("DELETE FROM chat_email_verifications WHERE user_id=?").bind(userId).run();
        } else {
          await env.DB.prepare("INSERT INTO chat_users(id,email,display_name,password_hash,password_salt) VALUES(?,?,?,?,?)")
            .bind(userId, email, displayName, passwordData.hash, passwordData.salt).run();
        }
        const token = randomToken();
        await env.DB.prepare("INSERT INTO chat_email_verifications(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)")
          .bind(id(), userId, await sha256(token), addMinutes(30)).run();
        try {
          await sendVerificationEmail(env, email, displayName, token);
        } catch (error) {
          return fail(request, "Account saved, but verification email could not be sent. Please retry registration or contact support. " + error.message, 502);
        }
        return reply(request, { success: true, message: "Verification email sent. Check your inbox." }, 201);
      }

      if (path === "/auth/verify" && request.method === "POST") {
        const body = await parseBody(request);
        const token = String(body?.token || "");
        if (token.length < 32 || token.length > 128) return fail(request, "Verification link is invalid or expired.", 400);
        const tokenHash = await sha256(token);
        const record = await env.DB.prepare(`
          SELECT id,user_id FROM chat_email_verifications
          WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?
        `).bind(tokenHash, now()).first();
        if (!record) return fail(request, "Verification link is invalid or expired.", 400);
        await env.DB.batch([
          env.DB.prepare("UPDATE chat_email_verifications SET consumed_at=? WHERE id=? AND consumed_at IS NULL").bind(now(), record.id),
          env.DB.prepare("UPDATE chat_users SET email_verified_at=?,updated_at=? WHERE id=?").bind(now(), now(), record.user_id)
        ]);
        return reply(request, { success: true, message: "Email verified. You can now sign in." });
      }

      if (path === "/auth/login" && request.method === "POST") {
        const body = await parseBody(request);
        const email = String(body?.email || "").trim().toLowerCase();
        const password = String(body?.password || "");
        const user = await env.DB.prepare("SELECT * FROM chat_users WHERE email=?").bind(email).first();
        if (!user || user.status !== "active") return fail(request, "Email or password is incorrect.", 401);
        if (!user.email_verified_at) return fail(request, "Please verify your email before signing in.", 403);
        const candidate = await passwordHash(password, user.password_salt);
        if (candidate.hash !== user.password_hash) return fail(request, "Email or password is incorrect.", 401);
        const token = randomToken();
        await env.DB.prepare("INSERT INTO chat_sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)")
          .bind(id(), user.id, await sha256(token), new Date(Date.now() + 30 * 86400_000).toISOString()).run();
        return reply(request, { success: true, token, user: { id: user.id, email: user.email, displayName: user.display_name, institutionName: user.institution_name, branchName: user.branch_name, semester: user.semester } });
      }

      if (path === "/auth/logout" && request.method === "POST") {
        const user = await currentUser(request, env);
        if (!user) return fail(request, "Sign in required.", 401);
        await env.DB.prepare("UPDATE chat_sessions SET revoked_at=? WHERE id=?").bind(now(), user.session_id).run();
        return reply(request, { success: true });
      }

      const user = await currentUser(request, env);
      if (!user) return fail(request, "Sign in to use Gradly Communities.", 401);

      if (path === "/auth/me" && request.method === "GET") {
        return reply(request, { success: true, user: { id: user.id, email: user.email, displayName: user.display_name, institutionName: user.institution_name, branchName: user.branch_name, semester: user.semester } });
      }

      if (path === "/groups" && request.method === "GET") {
        const q = "%" + String(url.searchParams.get("q") || "").slice(0, 80) + "%";
        const rows = await env.DB.prepare(`
          SELECT g.id,g.name,g.description,g.category,g.visibility,g.institution_name,g.branch_name,g.semester,g.created_at,
            (SELECT COUNT(*) FROM chat_group_members m WHERE m.group_id=g.id AND m.status='active') AS member_count,
            EXISTS(SELECT 1 FROM chat_group_members mine WHERE mine.group_id=g.id AND mine.user_id=? AND mine.status='active') AS is_member
          FROM chat_groups g
          WHERE g.status='active' AND (g.visibility='public' OR EXISTS(
            SELECT 1 FROM chat_group_members mine WHERE mine.group_id=g.id AND mine.user_id=? AND mine.status='active'
          )) AND (?='%%' OR g.name LIKE ? OR g.description LIKE ?)
          ORDER BY is_member DESC,member_count DESC,g.created_at DESC LIMIT 100
        `).bind(user.id, user.id, q, q, q).all();
        return reply(request, { success: true, groups: rows.results || [] });
      }

      if (path === "/groups/mine" && request.method === "GET") {
        const rows = await env.DB.prepare(`
          SELECT g.id,g.name,g.description,g.category,g.visibility,g.created_at,m.role,
            (SELECT COUNT(*) FROM chat_group_members x WHERE x.group_id=g.id AND x.status='active') AS member_count,
            (SELECT COUNT(*) FROM chat_messages x WHERE x.group_id=g.id AND x.sender_id<>m.user_id AND x.created_at>COALESCE(m.last_read_at,m.joined_at)) AS unread_count
          FROM chat_group_members m JOIN chat_groups g ON g.id=m.group_id
          WHERE m.user_id=? AND m.status='active' AND g.status='active'
          ORDER BY g.updated_at DESC
        `).bind(user.id).all();
        return reply(request, { success: true, groups: rows.results || [] });
      }

      if (path === "/groups" && request.method === "POST") {
        const body = await parseBody(request);
        const name = String(body?.name || "").trim();
        const description = String(body?.description || "").trim();
        const category = ["college","department","semester","subject","study","other"].includes(body?.category) ? body.category : "study";
        const visibility = ["public","private","invite_only"].includes(body?.visibility) ? body.visibility : "public";
        if (name.length < 3 || name.length > 70) return fail(request, "Group name must be 3–70 characters.");
        if (description.length > 500) return fail(request, "Description must be 500 characters or less.");
        const memberships = await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE user_id=? AND status='active'").bind(user.id).first();
        if ((memberships?.total || 0) >= 20) return fail(request, "You have reached the 20-group membership limit.", 429);
        const groupId = id();
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO chat_groups(id,name,description,category,visibility,institution_name,branch_name,semester,created_by) VALUES(?,?,?,?,?,?,?,?,?)`)
            .bind(groupId,name,description,category,visibility,body?.institutionName || user.institution_name || null,body?.branchName || user.branch_name || null,Number(body?.semester) || user.semester || null,user.id),
          env.DB.prepare("INSERT INTO chat_group_members(group_id,user_id,role) VALUES(?,?,'owner')").bind(groupId,user.id)
        ]);
        await audit(env,user.id,"group.created","group",groupId);
        return reply(request, { success: true, group: { id: groupId, name, description, category, visibility, role: "owner", member_count: 1 } }, 201);
      }

      const liveMatch = path.match(/^\/groups\/([a-f0-9-]+)\/live$/i);
      if (liveMatch && request.method === "GET") {
        if (request.headers.get("Upgrade") !== "websocket") return fail(request, "WebSocket upgrade required.", 426);
        const groupId = liveMatch[1];
        const ticket = url.searchParams.get("ticket") || "";
        if (ticket.length < 32 || ticket.length > 128) return fail(request, "Socket ticket is invalid or expired.", 401);
        const ticketHash = await sha256(ticket);
        const record = await env.DB.prepare(`
          SELECT id,user_id FROM chat_socket_tickets
          WHERE token_hash=? AND group_id=? AND consumed_at IS NULL AND expires_at>?
        `).bind(ticketHash,groupId,now()).first();
        if (!record) return fail(request, "Socket ticket is invalid or expired.", 401);
        const consumed = await env.DB.prepare(`
          UPDATE chat_socket_tickets SET consumed_at=?
          WHERE id=? AND consumed_at IS NULL AND expires_at>?
        `).bind(now(),record.id,now()).run();
        if ((consumed.meta?.changes || 0) !== 1) return fail(request, "Socket ticket has already been used.", 401);
        const headers = new Headers(request.headers);
        headers.set("x-chat-user", record.user_id);
        headers.set("x-chat-group", groupId);
        return env.CHAT_ROOMS.getByName(groupId).fetch(new Request(request, { headers }));
      }

      const groupMatch = path.match(/^\/groups\/([a-f0-9-]+)(?:\/(join|leave|messages|socket-ticket|reports|requests|pins|members))?$/i);
      if (groupMatch) {
        const groupId = groupMatch[1];
        const action = groupMatch[2] || "";
        const group = await env.DB.prepare("SELECT * FROM chat_groups WHERE id=? AND status='active'").bind(groupId).first();
        if (!group) return fail(request, "Group not found.", 404);
        const membership = await requireMember(env, groupId, user.id);

        if (!action && request.method === "GET") {
          if (!membership && group.visibility !== "public") return fail(request, "This group is private.", 403);
          const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE group_id=? AND status='active'").bind(groupId).first();
          const members = await env.DB.prepare(`
            SELECT u.id,u.display_name,u.avatar_url,m.role,m.joined_at
            FROM chat_group_members m JOIN chat_users u ON u.id=m.user_id
            WHERE m.group_id=? AND m.status='active' ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, u.display_name LIMIT 100
          `).bind(groupId).all();
          return reply(request, { success: true, group: { ...group, member_count: count?.total || 0 }, members: members.results || [], role: membership?.role || null });
        }

        if (action === "join" && request.method === "POST") {
          if (membership) return reply(request, { success: true, joined: true });
          const banned = await env.DB.prepare("SELECT 1 FROM chat_group_members WHERE group_id=? AND user_id=? AND status='banned'").bind(groupId,user.id).first();
          if (banned) return fail(request, "You are not allowed to join this group.", 403);
          const total = await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE user_id=? AND status='active'").bind(user.id).first();
          if ((total?.total || 0) >= 20) return fail(request, "You have reached the 20-group membership limit.", 429);
          if (group.visibility === "public") {
            await env.DB.prepare("INSERT INTO chat_group_members(group_id,user_id,role) VALUES(?,?,'member')").bind(groupId,user.id).run();
            await audit(env,user.id,"group.joined","group",groupId);
            return reply(request, { success: true, joined: true });
          }
          await env.DB.prepare("INSERT INTO chat_join_requests(id,group_id,user_id) VALUES(?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET status='pending',created_at=?")
            .bind(id(),groupId,user.id,now()).run();
          return reply(request, { success: true, requestPending: true });
        }

        if (action === "leave" && request.method === "POST") {
          if (!membership) return fail(request, "You are not a member of this group.", 403);
          if (membership.role === "owner") return fail(request, "Transfer ownership before leaving this group.", 409);
          await env.DB.prepare("UPDATE chat_group_members SET status='left' WHERE group_id=? AND user_id=?").bind(groupId,user.id).run();
          await audit(env,user.id,"group.left","group",groupId);
          return reply(request, { success: true });
        }

        if (action === "messages" && request.method === "GET") {
          if (!membership) return fail(request, "Join this group to view its messages.", 403);
          await env.DB.prepare("UPDATE chat_group_members SET last_read_at=? WHERE group_id=? AND user_id=?").bind(now(),groupId,user.id).run();
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
          const before = url.searchParams.get("before");
          const rows = await env.DB.prepare(`
            SELECT m.id,m.group_id,m.sender_id,m.body,m.reply_to_id,m.edited_at,m.deleted_at,m.created_at,u.display_name AS sender_name
            FROM chat_messages m JOIN chat_users u ON u.id=m.sender_id
            WHERE m.group_id=? AND (? IS NULL OR m.created_at<?)
            ORDER BY m.created_at DESC LIMIT ?
          `).bind(groupId,before,before,limit).all();
          return reply(request, { success: true, messages: (rows.results || []).reverse() });
        }

        if (action === "messages" && request.method === "POST") {
          if (!membership) return fail(request, "Join this group to send messages.", 403);
          const body = await parseBody(request);
          const text = String(body?.body || "").trim();
          if (!text || text.length > 5000) return fail(request, "Message must contain 1–5000 characters.");
          const rate = await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_messages WHERE sender_id=? AND created_at>=?")
            .bind(user.id,new Date(Date.now()-60_000).toISOString()).first();
          if ((rate?.total || 0) >= 10) return fail(request, "Message limit reached. Please wait a moment.", 429);
          const messageId = id();
          await env.DB.prepare("INSERT INTO chat_messages(id,group_id,sender_id,body,reply_to_id) VALUES(?,?,?,?,?)")
            .bind(messageId,groupId,user.id,text,body?.replyToId || null).run();
          return reply(request, { success: true, message: { id:messageId,group_id:groupId,sender_id:user.id,sender_name:user.display_name,body:text,reply_to_id:body?.replyToId || null,created_at:now() } }, 201);
        }

        if (action === "socket-ticket" && request.method === "POST") {
          if (!membership) return fail(request, "Join this group to connect.", 403);
          const ticket = randomToken();
          await env.DB.prepare("INSERT INTO chat_socket_tickets(id,user_id,group_id,token_hash,expires_at) VALUES(?,?,?,?,?)")
            .bind(id(),user.id,groupId,await sha256(ticket),addMinutes(1)).run();
          return reply(request, { success: true, ticket, expiresInSeconds: 60 });
        }


        if (action === "pins" && request.method === "GET") {
          if (!membership) return fail(request, "Join this group to view pinned messages.", 403);
          const rows = await env.DB.prepare("SELECT p.created_at AS pinned_at,m.id,m.body,m.sender_id,m.created_at,u.display_name AS sender_name FROM chat_pinned_messages p JOIN chat_messages m ON m.id=p.message_id JOIN chat_users u ON u.id=m.sender_id WHERE p.group_id=? AND m.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 100").bind(groupId).all();
          return reply(request,{success:true,pins:rows.results||[]});
        }
        if (action === "pins" && request.method === "POST") {
          if (!membership || !["owner","admin","moderator"].includes(membership.role)) return fail(request,"Group moderator permission required.",403);
          const body=await parseBody(request);
          const messageId=String(body?.messageId||"");
          const target=await env.DB.prepare("SELECT id FROM chat_messages WHERE id=? AND group_id=? AND deleted_at IS NULL").bind(messageId,groupId).first();
          if (!target) return fail(request,"Message not found.",404);
          await env.DB.prepare("INSERT OR IGNORE INTO chat_pinned_messages(group_id,message_id,pinned_by) VALUES(?,?,?)").bind(groupId,messageId,user.id).run();
          await audit(env,user.id,"message.pinned","message",messageId);
          return reply(request,{success:true});
        }
        if (action === "members" && request.method === "GET") {
          if (!membership) return fail(request,"Join this group to view members.",403);
          const rows=await env.DB.prepare("SELECT u.id,u.display_name,u.avatar_url,m.role,m.joined_at,m.muted_until FROM chat_group_members m JOIN chat_users u ON u.id=m.user_id WHERE m.group_id=? AND m.status='active' ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,u.display_name LIMIT 500").bind(groupId).all();
          return reply(request,{success:true,members:rows.results||[]});
        }
        if (action === "members" && request.method === "POST") {
          if (!membership || !["owner","admin","moderator"].includes(membership.role)) return fail(request,"Group moderator permission required.",403);
          const body=await parseBody(request);
          const targetId=String(body?.userId||"");
          const operation=String(body?.action||"");
          const target=await env.DB.prepare("SELECT role,status FROM chat_group_members WHERE group_id=? AND user_id=?").bind(groupId,targetId).first();
          if (!target || target.status!=="active") return fail(request,"Group member not found.",404);
          if (target.role==="owner") return fail(request,"The group owner cannot be changed through member moderation.",409);
          if (membership.role==="moderator" && ["admin","moderator"].includes(target.role)) return fail(request,"Moderators cannot manage group administrators.",403);
          if (operation==="make_moderator" || operation==="make_admin") {
            if (operation==="make_admin" && membership.role!=="owner") return fail(request,"Only the group owner can appoint an administrator.",403);
            if (operation==="make_moderator" && !["owner","admin"].includes(membership.role)) return fail(request,"Only an owner or administrator can appoint moderators.",403);
            await env.DB.prepare("UPDATE chat_group_members SET role=? WHERE group_id=? AND user_id=?").bind(operation==="make_admin"?"admin":"moderator",groupId,targetId).run();
          } else if (operation==="remove" || operation==="ban") {
            await env.DB.prepare("UPDATE chat_group_members SET status=? WHERE group_id=? AND user_id=?").bind(operation==="ban"?"banned":"removed",groupId,targetId).run();
          } else if (operation==="mute") {
            await env.DB.prepare("UPDATE chat_group_members SET muted_until=? WHERE group_id=? AND user_id=?").bind(addMinutes(24*60),groupId,targetId).run();
          } else if (operation==="unmute") {
            await env.DB.prepare("UPDATE chat_group_members SET muted_until=NULL WHERE group_id=? AND user_id=?").bind(groupId,targetId).run();
          } else return fail(request,"Unsupported member action.");
          await audit(env,user.id,"member."+operation,"user",targetId,"Group moderation",{groupId});
          return reply(request,{success:true});
        }

        if (action === "reports" && request.method === "POST") {
          const body = await parseBody(request);
          const reason = String(body?.reason || "").trim();
          const messageId = body?.messageId || null;
          const reportedUserId = body?.reportedUserId || null;
          if (reason.length < 3 || reason.length > 100) return fail(request, "Choose a report reason.");
          if (messageId) {
            const exists = await env.DB.prepare("SELECT 1 FROM chat_messages WHERE id=? AND group_id=?").bind(messageId,groupId).first();
            if (!exists) return fail(request, "Message not found.", 404);
          }
          const reportId=id();
          await env.DB.prepare("INSERT INTO chat_reports(id,reporter_id,group_id,message_id,reported_user_id,reason,details) VALUES(?,?,?,?,?,?,?)")
            .bind(reportId,user.id,groupId,messageId,reportedUserId,reason,String(body?.details||"").slice(0,1000)).run();
          await audit(env,user.id,"report.created","report",reportId);
          return reply(request,{success:true,reportId},201);
        }

        if (action === "requests" && request.method === "GET") {
          if (!membership || !["owner","admin","moderator"].includes(membership.role)) return fail(request,"Group admin permission required.",403);
          const rows=await env.DB.prepare(`
            SELECT r.id,r.user_id,r.created_at,u.display_name,u.email
            FROM chat_join_requests r JOIN chat_users u ON u.id=r.user_id
            WHERE r.group_id=? AND r.status='pending' ORDER BY r.created_at
          `).bind(groupId).all();
          return reply(request,{success:true,requests:rows.results||[]});
        }
        if (action === "requests" && request.method === "POST") {
          if (!membership || !["owner","admin","moderator"].includes(membership.role)) return fail(request,"Group admin permission required.",403);
          const body=await parseBody(request);
          const requestId=String(body?.requestId||"");
          const decision=body?.decision;
          if (!["approve","reject"].includes(decision)) return fail(request,"Decision must be approve or reject.");
          const row=await env.DB.prepare("SELECT * FROM chat_join_requests WHERE id=? AND group_id=? AND status='pending'").bind(requestId,groupId).first();
          if (!row) return fail(request,"Join request not found.",404);
          if (decision==="approve") {
            await env.DB.batch([
              env.DB.prepare("UPDATE chat_join_requests SET status='approved',reviewed_by=?,reviewed_at=? WHERE id=?").bind(user.id,now(),requestId),
              env.DB.prepare("INSERT INTO chat_group_members(group_id,user_id,role,status) VALUES(?,?,'member','active') ON CONFLICT(group_id,user_id) DO UPDATE SET role='member',status='active',joined_at=?").bind(groupId,row.user_id,now())
            ]);
          } else {
            await env.DB.prepare("UPDATE chat_join_requests SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=?").bind(user.id,now(),requestId).run();
          }
          await audit(env,user.id,"group.join_request."+decision,"join_request",requestId);
          return reply(request,{success:true});
        }
      }


      const unpinMatch=path.match(/^[/]groups[/]([a-f0-9-]+)[/]pins[/]([a-f0-9-]+)$/i);
      if (unpinMatch && request.method==="DELETE") {
        const groupId=unpinMatch[1],messageId=unpinMatch[2];
        const member=await requireMember(env,groupId,user.id);
        if (!member || !["owner","admin","moderator"].includes(member.role)) return fail(request,"Group moderator permission required.",403);
        await env.DB.prepare("DELETE FROM chat_pinned_messages WHERE group_id=? AND message_id=?").bind(groupId,messageId).run();
        await audit(env,user.id,"message.unpinned","message",messageId);
        return reply(request,{success:true});
      }


      const reactionMatch = path.match(/^[/]messages[/]([a-f0-9-]+)[/]reactions$/i);
      if (reactionMatch) {
        const messageId=reactionMatch[1];
        const message=await env.DB.prepare("SELECT group_id FROM chat_messages WHERE id=? AND deleted_at IS NULL").bind(messageId).first();
        if (!message) return fail(request,"Message not found.",404);
        const member=await requireMember(env,message.group_id,user.id);
        if (!member) return fail(request,"Group membership required.",403);
        if (request.method==="GET") {
          const rows=await env.DB.prepare("SELECT reaction,COUNT(*) AS total FROM chat_message_reactions WHERE message_id=? GROUP BY reaction").bind(messageId).all();
          return reply(request,{success:true,reactions:rows.results||[]});
        }
        if (request.method==="POST") {
          const body=await parseBody(request);
          const reaction=String(body?.reaction||"");
          if (!["👍","❤️","😂","😮","😢","🎉"].includes(reaction)) return fail(request,"Unsupported reaction.");
          const existing=await env.DB.prepare("SELECT 1 FROM chat_message_reactions WHERE message_id=? AND user_id=? AND reaction=?").bind(messageId,user.id,reaction).first();
          if (existing) await env.DB.prepare("DELETE FROM chat_message_reactions WHERE message_id=? AND user_id=? AND reaction=?").bind(messageId,user.id,reaction).run();
          else await env.DB.prepare("INSERT INTO chat_message_reactions(message_id,user_id,reaction) VALUES(?,?,?)").bind(messageId,user.id,reaction).run();
          return reply(request,{success:true,added:!existing});
        }
      }

      const messageMatch = path.match(/^\/messages\/([a-f0-9-]+)$/i);
      if (messageMatch && ["PATCH","DELETE"].includes(request.method)) {
        const messageId=messageMatch[1];
        const message=await env.DB.prepare("SELECT * FROM chat_messages WHERE id=? AND deleted_at IS NULL").bind(messageId).first();
        if (!message) return fail(request,"Message not found.",404);
        const member=await requireMember(env,message.group_id,user.id);
        if (!member) return fail(request,"Group membership required.",403);
        const canModerate=["owner","admin","moderator"].includes(member.role);
        if (request.method==="PATCH") {
          if (message.sender_id!==user.id) return fail(request,"You can only edit your own messages.",403);
          if (Date.now()-new Date(message.created_at).getTime()>15*60_000) return fail(request,"Messages can only be edited for 15 minutes.",409);
          const body=await parseBody(request);
          const text=String(body?.body||"").trim();
          if (!text||text.length>5000) return fail(request,"Message must contain 1–5000 characters.");
          await env.DB.prepare("UPDATE chat_messages SET body=?,edited_at=? WHERE id=?").bind(text,now(),messageId).run();
          return reply(request,{success:true});
        }
        if (message.sender_id!==user.id&&!canModerate) return fail(request,"You cannot delete this message.",403);
        await env.DB.prepare("UPDATE chat_messages SET deleted_at=?,deleted_by=? WHERE id=?").bind(now(),user.id,messageId).run();
        await audit(env,user.id,"message.deleted","message",messageId);
        return reply(request,{success:true});
      }


      if (path === "/admin/bootstrap" && request.method === "POST") {
        if (!env.COMMUNITIES_BOOTSTRAP_TOKEN) return fail(request,"Communities bootstrap is not configured.",503);
        const body=await parseBody(request);
        const supplied=String(body?.bootstrapToken||"");
        if (supplied.length<32 || supplied!==env.COMMUNITIES_BOOTSTRAP_TOKEN) return fail(request,"Bootstrap token is invalid.",403);
        const existing=await env.DB.prepare("SELECT user_id FROM chat_platform_roles WHERE role='super_admin' LIMIT 1").first();
        if (existing) return fail(request,"The initial Super Admin has already been configured.",409);
        await env.DB.prepare("INSERT INTO chat_platform_roles(user_id,role) VALUES(?,'super_admin')").bind(user.id).run();
        await audit(env,user.id,"platform.super_admin.bootstrap","user",user.id,"Initial Super Admin bootstrap");
        return reply(request,{success:true,message:"You are now the Communities Super Admin."});
      }

      if (path === "/admin/overview" && request.method === "GET") {
        const role=await isPlatformAdmin(env,user.id);
        if (!role) return fail(request,"Communities platform administrator permission required.",403);
        const [users,groups,messages,reports,attachments]=await Promise.all([
          env.DB.prepare("SELECT COUNT(*) AS total FROM chat_users WHERE status='active'").first(),
          env.DB.prepare("SELECT COUNT(*) AS total FROM chat_groups WHERE status='active'").first(),
          env.DB.prepare("SELECT COUNT(*) AS total FROM chat_messages WHERE deleted_at IS NULL").first(),
          env.DB.prepare("SELECT COUNT(*) AS total FROM chat_reports WHERE status IN ('open','reviewing')").first(),
          env.DB.prepare("SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM chat_message_attachments WHERE deleted_at IS NULL").first()
        ]);
        return reply(request,{success:true,overview:{activeUsers:users?.total||0,activeGroups:groups?.total||0,messages:messages?.total||0,openReports:reports?.total||0,storedMediaBytes:attachments?.bytes||0}});
      }

      if (path === "/admin/roles" && request.method === "POST") {
        const role=await isPlatformAdmin(env,user.id);
        if (role?.role!=="super_admin") return fail(request,"Only the Communities Super Admin can manage platform roles.",403);
        const body=await parseBody(request);
        const targetId=String(body?.userId||"");
        const targetRole=String(body?.role||"");
        const operation=String(body?.action||"grant");
        if (!["platform_admin","super_admin"].includes(targetRole) || !["grant","revoke"].includes(operation)) return fail(request,"Invalid role operation.");
        const target=await env.DB.prepare("SELECT id FROM chat_users WHERE id=? AND status='active'").bind(targetId).first();
        if (!target) return fail(request,"Communities user not found.",404);
        if (operation==="grant") {
          await env.DB.prepare("INSERT OR IGNORE INTO chat_platform_roles(user_id,role,granted_by) VALUES(?,?,?)").bind(targetId,targetRole,user.id).run();
        } else {
          if (targetId===user.id && targetRole==="super_admin") {
            const total=await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_platform_roles WHERE role='super_admin'").first();
            if ((total?.total||0)<=1) return fail(request,"You cannot remove the last Super Admin.",409);
          }
          await env.DB.prepare("DELETE FROM chat_platform_roles WHERE user_id=? AND role=?").bind(targetId,targetRole).run();
        }
        await audit(env,user.id,"platform.role."+operation,"user",targetId,"Role "+targetRole,{role:targetRole});
        return reply(request,{success:true});
      }

      const reportDetail=path.match(/^[/]admin[/]reports[/]([a-f0-9-]+)$/i);
      if (reportDetail && request.method==="GET") {
        const role=await isPlatformAdmin(env,user.id);
        if (!role) return fail(request,"Communities platform administrator permission required.",403);
        const report=await env.DB.prepare("SELECT * FROM chat_reports WHERE id=?").bind(reportDetail[1]).first();
        if (!report) return fail(request,"Report not found.",404);
        let reportedMessage=null;
        if (report.message_id) {
          reportedMessage=await env.DB.prepare("SELECT id,group_id,sender_id,body,created_at,edited_at,deleted_at FROM chat_messages WHERE id=?").bind(report.message_id).first();
        }
        await audit(env,user.id,"moderation.report_message_viewed","report",report.id,"Access limited to a reported message");
        return reply(request,{success:true,report,reportedMessage});
      }
      const reportResolve=path.match(/^[/]admin[/]reports[/]([a-f0-9-]+)[/]resolve$/i);
      if (reportResolve && request.method==="POST") {
        const role=await isPlatformAdmin(env,user.id);
        if (!role) return fail(request,"Communities platform administrator permission required.",403);
        const body=await parseBody(request);
        const status=body?.status;
        if (!["resolved","dismissed"].includes(status)) return fail(request,"Status must be resolved or dismissed.");
        const reason=String(body?.reason||"").slice(0,500);
        await env.DB.prepare("UPDATE chat_reports SET status=?,assigned_to=?,resolved_at=? WHERE id=? AND status IN ('open','reviewing')").bind(status,user.id,now(),reportResolve[1]).run();
        await audit(env,user.id,"moderation.report."+status,"report",reportResolve[1],reason);
        return reply(request,{success:true});
      }

      if (path === "/admin/reports" && request.method === "GET") {
        const role=await isPlatformAdmin(env,user.id);
        if (!role) return fail(request,"Communities platform administrator permission required.",403);
        const rows=await env.DB.prepare(`
          SELECT r.*,u.display_name AS reporter_name,g.name AS group_name
          FROM chat_reports r JOIN chat_users u ON u.id=r.reporter_id
          LEFT JOIN chat_groups g ON g.id=r.group_id
          WHERE r.status IN ('open','reviewing') ORDER BY r.created_at ASC LIMIT 200
        `).all();
        return reply(request,{success:true,reports:rows.results||[]});
      }

      return fail(request,"Route not found.",404);
    } catch (error) {
      console.error("Communities API error", error);
      return fail(request,"The Communities service could not complete this request.",500);
    }
  }
};
