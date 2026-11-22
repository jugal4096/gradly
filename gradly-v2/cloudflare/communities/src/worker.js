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
  "https://gradly-ecosystem.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174"
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

async function getLimits(env) {
  const defaults={maxGroupMemberships:20,maxGroupMembers:500,maxMessageLength:5000,messagesPerMinute:10,photosPerMessage:10,photoBytes:5242880,videoBytes:26214400,videoSeconds:120,pdfBytes:15728640,officeBytes:10485760,userStorageBytes:104857600,uploadsPerDay:20,videosPerDay:3};
  const row=await env.DB.prepare("SELECT value_json FROM chat_platform_settings WHERE key='limits'").first();
  try { return {...defaults,...JSON.parse(row?.value_json||"{}")}; } catch { return defaults; }
}

function readAscii(bytes,start,length) {
  let out="";
  for(let i=0;i<length&&start+i<bytes.length;i++) out+=String.fromCharCode(bytes[start+i]);
  return out;
}
function mp4Duration(buffer) {
  const view=new DataView(buffer), end=buffer.byteLength;
  let position=0;
  while(position+8<=end) {
    let size=view.getUint32(position);
    const type=readAscii(new Uint8Array(buffer),position+4,4);
    let header=8;
    if(size===1 && position+16<=end) { size=Number(view.getBigUint64(position+8)); header=16; }
    if(size===0) size=end-position;
    if(size<header || position+size>end) break;
    if(type==="moov") {
      let child=position+header, childEnd=position+size;
      while(child+8<=childEnd) {
        let childSize=view.getUint32(child), childType=readAscii(new Uint8Array(buffer),child+4,4), childHeader=8;
        if(childSize===1 && child+16<=childEnd) { childSize=Number(view.getBigUint64(child+8)); childHeader=16; }
        if(childSize===0) childSize=childEnd-child;
        if(childSize<childHeader || child+childSize>childEnd) break;
        if(childType==="mvhd") {
          const version=view.getUint8(child+childHeader);
          const scaleOffset=version===1?child+childHeader+20:child+childHeader+12;
          const durationOffset=version===1?child+childHeader+24:child+childHeader+16;
          const scale=view.getUint32(scaleOffset);
          const duration=version===1?Number(view.getBigUint64(durationOffset)):view.getUint32(durationOffset);
          if(scale>0 && duration>0) return duration/scale;
        }
        child+=childSize;
      }
    }
    position+=size;
  }
  return null;
}
function webmDuration(bytes) {
  let scale=1000000, duration=null;
  for(let i=0;i<bytes.length-12;i++) {
    if(bytes[i]===0x2a&&bytes[i+1]===0xd7&&bytes[i+2]===0xb1) {
      const size=bytes[i+3]&0x7f;
      if(size>0&&size<=4&&i+4+size<=bytes.length) {
        scale=0;
        for(let j=0;j<size;j++) scale=scale*256+bytes[i+4+j];
      }
    }
    if(bytes[i]===0x44&&bytes[i+1]===0x89) {
      const first=bytes[i+2], sizeLength=first&0x80?1:first&0x40?2:first&0x20?3:first&0x10?4:0;
      if(!sizeLength) continue;
      let size=first&(0xff>>sizeLength);
      for(let j=1;j<sizeLength;j++) size=size*256+bytes[i+2+j];
      const start=i+2+sizeLength;
      if((size===4||size===8)&&start+size<=bytes.length) {
        const view=new DataView(bytes.buffer,bytes.byteOffset+start,size);
        duration=size===8?view.getFloat64(0):view.getFloat32(0);
      }
    }
  }
  return duration!==null&&scale>0?duration*scale/1e9:null;
}
async function inspectCommunityUpload(file, limits) {
  const name=String(file.name||"file").slice(0,180);
  const ext=name.toLowerCase().split(".").pop();
  const bytes=new Uint8Array(await file.arrayBuffer());
  const mime=String(file.type||"").toLowerCase();
  const starts=(arr)=>arr.every((value,index)=>bytes[index]===value);
  let kind="",expectedMime="",duration=null,maxBytes=0;
  if(["jpg","jpeg","png","webp"].includes(ext)) {
    const valid=(ext==="jpg"||ext==="jpeg")?starts([0xff,0xd8,0xff]):ext==="png"?starts([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]):readAscii(bytes,0,4)==="RIFF"&&readAscii(bytes,8,4)==="WEBP";
    if(!valid) throw new Error("Image signature does not match its file extension.");
    kind="photo"; expectedMime=ext==="png"?"image/png":ext==="webp"?"image/webp":"image/jpeg"; maxBytes=limits.photoBytes;
  } else if(ext==="mp4"||ext==="webm") {
    const valid=ext==="mp4"?readAscii(bytes,4,4)==="ftyp":starts([0x1a,0x45,0xdf,0xa3]);
    if(!valid) throw new Error("Video signature does not match its file extension.");
    kind="video"; expectedMime=ext==="mp4"?"video/mp4":"video/webm"; maxBytes=limits.videoBytes;
    duration=ext==="mp4"?mp4Duration(bytes.buffer):webmDuration(bytes);
    if(!duration||!Number.isFinite(duration)) throw new Error("The video duration could not be verified. Please export as a standard MP4 or WebM file.");
    if(duration>limits.videoSeconds) throw new Error("Videos must be "+limits.videoSeconds+" seconds or shorter.");
  } else if(ext==="pdf") {
    if(readAscii(bytes,0,5)!=="%PDF-") throw new Error("PDF signature is invalid.");
    kind="document"; expectedMime="application/pdf"; maxBytes=limits.pdfBytes;
  } else if(ext==="docx"||ext==="pptx") {
    const zip=starts([0x50,0x4b,0x03,0x04]);
    const text=readAscii(bytes,0,Math.min(bytes.length,bytes.length));
    const valid=zip&&(ext==="docx"?text.includes("word/document.xml"):text.includes("ppt/presentation.xml"));
    if(!valid) throw new Error("Only valid DOCX and PPTX files are accepted.");
    kind="document"; expectedMime=ext==="docx"?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":"application/vnd.openxmlformats-officedocument.presentationml.presentation"; maxBytes=limits.officeBytes;
  } else {
    throw new Error("Unsupported file type. Share JPG, PNG, WebP, MP4, WebM, PDF, DOCX or PPTX.");
  }
  if(file.size<1||file.size>maxBytes) throw new Error(name+" exceeds its allowed file size.");
  return {name,mime:expectedMime,kind,duration:duration?Math.ceil(duration):null,size:file.size,buffer};
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
    SELECT m.role,m.status,m.muted_until,g.status AS group_status,g.visibility
    FROM chat_group_members m JOIN chat_groups g ON g.id=m.group_id
    WHERE m.group_id=? AND m.user_id=? AND m.status='active' AND g.status='active'
  `).bind(groupId, userId).first();
}

async function getEcosystemIdentity(request, env, identityType) {
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if (!token) return null;
  const backend=(env.GRADLY_BACKEND_URL||"https://gradly-backend-1q7s.onrender.com").replace(/\/$/,"");
  const endpoint=identityType==="admin"?"/api/admin/me":"/api/super-admin/me";
  try {
    const response=await fetch(backend+endpoint,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
    if (!response.ok) return null;
    const data=await response.json();
    const identity=identityType==="admin"?(data.admin||data.data?.admin):(data.superAdmin||data.data?.superAdmin);
    const identityId=identityType==="admin"?(identity?.admin_code||identity?.adminCode):(identity?.adminCode||identity?.admin_code);
    if (!identityId) return null;
    return { identityId:String(identityId), displayName:String(identity?.full_name||identity?.fullName||identityId), email:String(identity?.email||"") };
  } catch (error) {
    console.error("Ecosystem identity verification failed",error);
    return null;
  }
}
async function hasExternalRole(env, identityType, identityId, requiredRole) {
  return env.DB.prepare("SELECT role FROM chat_external_roles WHERE identity_type=? AND identity_id=? AND role=? AND revoked_at IS NULL")
    .bind(identityType,identityId,requiredRole).first();
}
async function auditExternal(env, identityType, identityId, action, targetType, targetId, reason="", metadata={}) {
  await env.DB.prepare("INSERT INTO chat_audit_logs(id,actor_id,action,target_type,target_id,reason,metadata_json) VALUES(?,NULL,?,?,?,?,?)")
    .bind(id(),"ecosystem."+identityType+"."+action,targetType,targetId||null,reason,JSON.stringify({identityType,identityId,...metadata})).run();
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
async function sendLoginEmail(env, email, displayName, token) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Email sign-in is not configured. Add RESEND_API_KEY and EMAIL_FROM Worker secrets.");
  const base = env.COMMUNITY_APP_URL || "https://gradly-peach.vercel.app";
  const link = base.replace(/\/$/, "") + "/community/verify?loginToken=" + encodeURIComponent(token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "authorization": "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Your Gradly Communities sign-in link",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#171717"><h2>Hi ${escapeHtml(displayName)}.</h2><p>Use this secure, one-time link to sign in to Gradly Communities.</p><p><a href="${link}" style="display:inline-block;background:#171717;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Sign in to Communities</a></p><p>This link expires in 15 minutes and can only be used once. If you did not request it, ignore this email.</p></div>`
    })
  });
  if (!response.ok) throw new Error("Email provider rejected the sign-in email (" + response.status + ").");
}
async function sendGroupInviteEmail(env, email, groupName, inviterName, token) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Group invitations require the Communities email provider to be configured.");
  const base=env.COMMUNITY_APP_URL||"https://gradly-peach.vercel.app";
  const link=base.replace(/\/$/,"")+"/community/verify?inviteToken="+encodeURIComponent(token);
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"authorization":"Bearer "+env.RESEND_API_KEY,"content-type":"application/json"},
    body:JSON.stringify({
      from:env.EMAIL_FROM,
      to:[email],
      subject:"You have been invited to a Gradly study group",
      html:"<div style='font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#171717'><h2>You are invited to "+escapeHtml(groupName)+".</h2><p>"+escapeHtml(inviterName)+" invited you to join this Gradly Communities group.</p><p><a href='"+link+"' style='display:inline-block;background:#171717;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none'>View invitation</a></p><p>This invitation expires in 7 days. You may need to create and verify a Communities account before accepting.</p></div>"
    })
  });
  if(!response.ok) throw new Error("Email provider rejected the invitation ("+response.status+").");
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
    if (!body) {
      ws.send(JSON.stringify({ type: "error", error: "Messages cannot be empty." }));
      return;
    }
    const { userId, groupId } = attachment;
    const member = await requireMember(this.env, groupId, userId);
    if (!member) { ws.close(1008, "Membership is no longer active"); return; }
    if (member.muted_until && new Date(member.muted_until).getTime() > Date.now()) {
      ws.send(JSON.stringify({ type: "error", error: "You are temporarily muted in this group." }));
      return;
    }
    let replyToId = null;
    if (data.replyToId) {
      const parent = await this.env.DB.prepare("SELECT id FROM chat_messages WHERE id=? AND group_id=? AND deleted_at IS NULL").bind(String(data.replyToId),groupId).first();
      if (parent) replyToId = parent.id;
    }
    const limits=await getLimits(this.env);
    if (body.length > limits.maxMessageLength) {
      ws.send(JSON.stringify({ type: "error", error: "Messages are limited to " + limits.maxMessageLength + " characters." }));
      return;
    }
    const rate = await this.env.DB.prepare(`
      SELECT COUNT(*) AS total FROM chat_messages
      WHERE sender_id=? AND created_at>=?
    `).bind(userId, new Date(Date.now() - 60_000).toISOString()).first();
    if ((rate?.total || 0) >= limits.messagesPerMinute) {
      ws.send(JSON.stringify({ type: "error", error: "Message limit reached. Please wait a moment." }));
      return;
    }
    const messageId = id();
    await this.env.DB.prepare(`
      INSERT INTO chat_messages(id,group_id,sender_id,body,reply_to_id)
      VALUES(?,?,?,?,?)
    `).bind(messageId, groupId, userId, body, replyToId).run();
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
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail(request, "Enter a valid email address.");
        if (displayName.length < 2 || displayName.length > 60) return fail(request, "Name must be 2–60 characters.");
        if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return fail(request, "Email verification is not configured yet. The platform administrator must configure the email provider.", 503);
        const existing = await env.DB.prepare("SELECT id,email_verified_at FROM chat_users WHERE email=?").bind(email).first();
        if (existing?.email_verified_at) return fail(request, "An account already exists for this email. Please sign in.", 409);
        const userId = existing?.id || id();
        if (existing) {
          await env.DB.prepare("UPDATE chat_users SET display_name=?,updated_at=? WHERE id=?").bind(displayName,now(),userId).run();
          await env.DB.prepare("DELETE FROM chat_email_verifications WHERE user_id=?").bind(userId).run();
        } else {
          await env.DB.prepare("INSERT INTO chat_users(id,email,display_name,password_hash,password_salt) VALUES(?,?,?,?,?)")
            .bind(userId,email,displayName,randomToken(32),randomToken(16)).run();
        }
        const token = randomToken();
        await env.DB.prepare("INSERT INTO chat_email_verifications(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)")
          .bind(id(),userId,await sha256(token),addMinutes(30)).run();
        try {
          await sendVerificationEmail(env,email,displayName,token);
        } catch (error) {
          return fail(request,"Account saved, but verification email could not be sent. Please retry registration or contact support. "+error.message,502);
        }
        return reply(request,{success:true,message:"Verification email sent. Check your inbox."},201);
      }

      if (path === "/auth/verify" && request.method === "POST") {
        const body = await parseBody(request);
        const token = String(body?.token || "");
        if (token.length < 32 || token.length > 128) return fail(request,"Verification link is invalid or expired.",400);
        const tokenHash = await sha256(token);
        const record = await env.DB.prepare("SELECT v.id,v.user_id,u.email,u.display_name,u.institution_name,u.branch_name,u.semester FROM chat_email_verifications v JOIN chat_users u ON u.id=v.user_id WHERE v.token_hash=? AND v.consumed_at IS NULL AND v.expires_at>?")
          .bind(tokenHash,now()).first();
        if (!record) return fail(request,"Verification link is invalid or expired.",400);
        const sessionToken=randomToken();
        await env.DB.batch([
          env.DB.prepare("UPDATE chat_email_verifications SET consumed_at=? WHERE id=? AND consumed_at IS NULL").bind(now(),record.id),
          env.DB.prepare("UPDATE chat_users SET email_verified_at=?,updated_at=? WHERE id=?").bind(now(),now(),record.user_id),
          env.DB.prepare("INSERT INTO chat_sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(id(),record.user_id,await sha256(sessionToken),new Date(Date.now()+30*86400_000).toISOString())
        ]);
        return reply(request,{success:true,token:sessionToken,message:"Email verified. You are signed in.",user:{id:record.user_id,email:record.email,displayName:record.display_name,institutionName:record.institution_name,branchName:record.branch_name,semester:record.semester}});
      }

      if (path === "/auth/login" && request.method === "POST") {
        const body=await parseBody(request);
        const email=String(body?.email||"").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return fail(request,"Enter a valid email address.");
        if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return fail(request,"Email sign-in is not configured yet. The platform administrator must configure the email provider.",503);
        const user=await env.DB.prepare("SELECT id,email,display_name,email_verified_at,status FROM chat_users WHERE email=?").bind(email).first();
        if (!user || user.status!=="active") return reply(request,{success:true,message:"If a verified Communities account exists for this email, a sign-in link has been sent."});
        if (!user.email_verified_at) {
          const verifyToken=randomToken();
          await env.DB.prepare("DELETE FROM chat_email_verifications WHERE user_id=?").bind(user.id).run();
          await env.DB.prepare("INSERT INTO chat_email_verifications(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(id(),user.id,await sha256(verifyToken),addMinutes(30)).run();
          await sendVerificationEmail(env,email,user.display_name,verifyToken);
          return reply(request,{success:true,message:"Your account still needs email verification. We sent you a fresh verification link."});
        }
        const recent=await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_login_tokens WHERE user_id=? AND created_at>=?").bind(user.id,new Date(Date.now()-15*60_000).toISOString()).first();
        if ((recent?.total||0)>=3) return fail(request,"Too many sign-in links requested. Please wait 15 minutes.",429);
        const loginToken=randomToken();
        await env.DB.prepare("INSERT INTO chat_login_tokens(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(id(),user.id,await sha256(loginToken),addMinutes(15)).run();
        try { await sendLoginEmail(env,email,user.display_name,loginToken); }
        catch (error) { return fail(request,"Unable to send sign-in link. "+error.message,502); }
        return reply(request,{success:true,message:"A secure sign-in link has been sent to your email."});
      }

      if (path === "/auth/login/verify" && request.method === "POST") {
        const body=await parseBody(request);
        const token=String(body?.token||"");
        if (token.length<32||token.length>128) return fail(request,"Sign-in link is invalid or expired.",400);
        const tokenHash=await sha256(token);
        const record=await env.DB.prepare("SELECT t.id,t.user_id,u.email,u.display_name,u.institution_name,u.branch_name,u.semester FROM chat_login_tokens t JOIN chat_users u ON u.id=t.user_id WHERE t.token_hash=? AND t.consumed_at IS NULL AND t.expires_at>? AND u.status='active' AND u.email_verified_at IS NOT NULL")
          .bind(tokenHash,now()).first();
        if (!record) return fail(request,"Sign-in link is invalid or expired.",400);
        const sessionToken=randomToken();
        await env.DB.batch([
          env.DB.prepare("UPDATE chat_login_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL").bind(now(),record.id),
          env.DB.prepare("INSERT INTO chat_sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(id(),record.user_id,await sha256(sessionToken),new Date(Date.now()+30*86400_000).toISOString())
        ]);
        return reply(request,{success:true,token:sessionToken,user:{id:record.user_id,email:record.email,displayName:record.display_name,institutionName:record.institution_name,branchName:record.branch_name,semester:record.semester}});
      }

      if (path === "/auth/logout" && request.method === "POST") {
  
      // Existing Ecosystem Admin and Super Admin identities are verified against
      // the existing Gradly backend. Communities permissions remain explicit in D1.
      const ecosystemAdmin = path.startsWith("/ecosystem/admin/") ? await getEcosystemIdentity(request,env,"admin") : null;
      if (path.startsWith("/ecosystem/admin/")) {
        if (!ecosystemAdmin) return fail(request,"Valid Gradly Admin session required.",401);
        const permission=await hasExternalRole(env,"admin",ecosystemAdmin.identityId,"platform_admin");
        if (!permission) return fail(request,"Your Gradly Admin account has not been granted Communities access.",403);
        if (path==="/ecosystem/admin/overview" && request.method==="GET") {
          const [users,groups,messages,reports]=await Promise.all([
            env.DB.prepare("SELECT COUNT(*) AS total FROM chat_users WHERE status='active'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM chat_groups WHERE status='active'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM chat_messages WHERE deleted_at IS NULL").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM chat_reports WHERE status IN ('open','reviewing')").first()
          ]);
          return reply(request,{success:true,admin:ecosystemAdmin,overview:{activeUsers:users?.total||0,activeGroups:groups?.total||0,messages:messages?.total||0,openReports:reports?.total||0}});
        }
        if (path==="/ecosystem/admin/reports" && request.method==="GET") {
          const rows=await env.DB.prepare("SELECT r.id,r.reason,r.details,r.status,r.created_at,g.name AS group_name,u.display_name AS reporter_name FROM chat_reports r LEFT JOIN chat_groups g ON g.id=r.group_id JOIN chat_users u ON u.id=r.reporter_id WHERE r.status IN ('open','reviewing') ORDER BY r.created_at ASC LIMIT 200").all();
          return reply(request,{success:true,reports:rows.results||[]});
        }
        const detail=path.match(/^[/]ecosystem[/]admin[/]reports[/]([a-f0-9-]+)$/i);
        if (detail && request.method==="GET") {
          const report=await env.DB.prepare("SELECT * FROM chat_reports WHERE id=?").bind(detail[1]).first();
          if (!report) return fail(request,"Report not found.",404);
          const reportedMessage=report.message_id?await env.DB.prepare("SELECT id,group_id,sender_id,body,created_at,edited_at,deleted_at FROM chat_messages WHERE id=?").bind(report.message_id).first():null;
          await auditExternal(env,"admin",ecosystemAdmin.identityId,"reported_message_viewed","report",report.id,"Access limited to a reported message");
          return reply(request,{success:true,report,reportedMessage});
        }
        const resolve=path.match(/^[/]ecosystem[/]admin[/]reports[/]([a-f0-9-]+)[/]resolve$/i);
        if (resolve && request.method==="POST") {
          const body=await parseBody(request), status=body?.status;
          if (!["resolved","dismissed"].includes(status)) return fail(request,"Status must be resolved or dismissed.");
          const reason=String(body?.reason||"").slice(0,500);
          await env.DB.prepare("UPDATE chat_reports SET status=?,assigned_to=NULL,resolved_at=? WHERE id=? AND status IN ('open','reviewing')").bind(status,now(),resolve[1]).run();
          await auditExternal(env,"admin",ecosystemAdmin.identityId,"report."+status,"report",resolve[1],reason);
          return reply(request,{success:true});
        }
        return fail(request,"Ecosystem Admin Communities route not found.",404);
      }

      if (path.startsWith("/ecosystem/super-admin/")) {
        const ecosystemSuperAdmin=await getEcosystemIdentity(request,env,"super_admin");
        if (!ecosystemSuperAdmin) return fail(request,"Valid Gradly Super Admin session required.",401);
        if (path==="/ecosystem/super-admin/bootstrap" && request.method==="POST") {
          const existing=await env.DB.prepare("SELECT identity_id FROM chat_external_roles WHERE identity_type='super_admin' AND role='super_admin' AND revoked_at IS NULL LIMIT 1").first();
          if (existing && existing.identity_id!==ecosystemSuperAdmin.identityId) return fail(request,"Communities Super Admin has already been bootstrapped.",409);
          await env.DB.prepare("INSERT INTO chat_external_roles(identity_type,identity_id,role,granted_by_type,granted_by_id) VALUES('super_admin',?,'super_admin','ecosystem_super_admin',?) ON CONFLICT(identity_type,identity_id) DO UPDATE SET role='super_admin',revoked_at=NULL,revoked_by_id=NULL")
            .bind(ecosystemSuperAdmin.identityId,ecosystemSuperAdmin.identityId).run();
          await auditExternal(env,"super_admin",ecosystemSuperAdmin.identityId,"bootstrap","super_admin",ecosystemSuperAdmin.identityId,"Existing Gradly Super Admin identity bootstrap");
          return reply(request,{success:true,message:"Your existing Gradly Super Admin identity is now enabled for Communities."});
        }
        const permission=await hasExternalRole(env,"super_admin",ecosystemSuperAdmin.identityId,"super_admin");
        if (!permission) return fail(request,"Complete the one-time Communities bootstrap first.",403);
        if (path==="/ecosystem/super-admin/overview" && request.method==="GET") {
          const [users,groups,messages,reports,media]=await Promise.all([
            env.DB.prepare("SELECT COUNT(*) AS total FROM chat_users").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM chat_groups WHERE status='active'").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM chat_messages WHERE deleted_at IS NULL").first(),
            env.DB.prepare("SELECT COUNT(*) AS total FROM chat_reports WHERE status IN ('open','reviewing')").first(),
            env.DB.prepare("SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM chat_message_attachments WHERE deleted_at IS NULL").first()
          ]);
          return reply(request,{success:true,superAdmin:ecosystemSuperAdmin,overview:{users:users?.total||0,groups:groups?.total||0,messages:messages?.total||0,openReports:reports?.total||0,storedMediaBytes:media?.bytes||0}});
        }
        if (path==="/ecosystem/super-admin/admin-roles" && request.method==="GET") {
          const rows=await env.DB.prepare("SELECT identity_id AS admin_code,role,granted_at,revoked_at FROM chat_external_roles WHERE identity_type='admin' ORDER BY granted_at DESC").all();
          return reply(request,{success:true,admins:rows.results||[]});
        }
        if (path==="/ecosystem/super-admin/admin-roles" && request.method==="POST") {
          const body=await parseBody(request), adminCode=String(body?.adminCode||"").trim(), action=String(body?.action||"grant");
          if (!/^[A-Za-z0-9_-]{3,40}$/.test(adminCode) || !["grant","revoke"].includes(action)) return fail(request,"Enter a valid Admin ID and grant/revoke action.");
          if (action==="grant") {
            await env.DB.prepare("INSERT INTO chat_external_roles(identity_type,identity_id,role,granted_by_type,granted_by_id) VALUES('admin',?,'platform_admin','super_admin',?) ON CONFLICT(identity_type,identity_id) DO UPDATE SET role='platform_admin',granted_by_id=excluded.granted_by_id,granted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revoked_at=NULL,revoked_by_id=NULL")
              .bind(adminCode,ecosystemSuperAdmin.identityId).run();
          } else {
            await env.DB.prepare("UPDATE chat_external_roles SET revoked_at=?,revoked_by_id=? WHERE identity_type='admin' AND identity_id=?").bind(now(),ecosystemSuperAdmin.identityId,adminCode).run();
          }
          await auditExternal(env,"super_admin","admin_role."+action,"admin",adminCode,"Communities Admin access "+action);
          return reply(request,{success:true});
        }
        if (path==="/ecosystem/super-admin/reports" && request.method==="GET") {
          const rows=await env.DB.prepare("SELECT r.*,g.name AS group_name,u.display_name AS reporter_name FROM chat_reports r LEFT JOIN chat_groups g ON g.id=r.group_id JOIN chat_users u ON u.id=r.reporter_id WHERE r.status IN ('open','reviewing') ORDER BY r.created_at ASC LIMIT 300").all();
          return reply(request,{success:true,reports:rows.results||[]});
        }

        const saReportDetail=path.match(/^[/]ecosystem[/]super-admin[/]reports[/]([a-f0-9-]+)$/i);
        if (saReportDetail && request.method==="GET") {
          const report=await env.DB.prepare("SELECT * FROM chat_reports WHERE id=?").bind(saReportDetail[1]).first();
          if (!report) return fail(request,"Report not found.",404);
          const reportedMessage=report.message_id?await env.DB.prepare("SELECT id,group_id,sender_id,body,created_at,edited_at,deleted_at FROM chat_messages WHERE id=?").bind(report.message_id).first():null;
          await auditExternal(env,"super_admin",ecosystemSuperAdmin.identityId,"reported_message_viewed","report",report.id,"Access limited to a reported message");
          return reply(request,{success:true,report,reportedMessage});
        }
        const saResolve=path.match(/^[/]ecosystem[/]super-admin[/]reports[/]([a-f0-9-]+)[/]resolve$/i);
        if (saResolve && request.method==="POST") {
          const body=await parseBody(request), status=body?.status;
          if (!["resolved","dismissed"].includes(status)) return fail(request,"Status must be resolved or dismissed.");
          const reason=String(body?.reason||"").slice(0,500);
          await env.DB.prepare("UPDATE chat_reports SET status=?,assigned_to=NULL,resolved_at=? WHERE id=? AND status IN ('open','reviewing')").bind(status,now(),saResolve[1]).run();
          await auditExternal(env,"super_admin",ecosystemSuperAdmin.identityId,"report."+status,"report",saResolve[1],reason);
          return reply(request,{success:true});
        }

        if (path==="/ecosystem/super-admin/settings" && request.method==="GET") {
          const rows=await env.DB.prepare("SELECT key,value_json,updated_at FROM chat_platform_settings ORDER BY key").all();
          return reply(request,{success:true,settings:rows.results||[]});
        }
        if (path==="/ecosystem/super-admin/settings" && request.method==="PATCH") {
          const body=await parseBody(request);
          if (!body || !["limits","features"].includes(String(body.key))) return fail(request,"Only supported Communities settings can be updated.");
          const value=body.value;
          if (!value || typeof value!=="object" || Array.isArray(value)) return fail(request,"Settings value must be an object.");
          if (body.key==="limits") {
            const numeric=["maxGroupMemberships","maxGroupMembers","maxMessageLength","messagesPerMinute","photosPerMessage","photoBytes","videoBytes","videoSeconds","pdfBytes","officeBytes","userStorageBytes","uploadsPerDay","videosPerDay"];
            for (const key of numeric) if (!Number.isInteger(value[key]) || value[key]<1) return fail(request,"All limit values must be positive integers.");
            const ceilings={maxGroupMemberships:100,maxGroupMembers:500,maxMessageLength:5000,messagesPerMinute:60,photosPerMessage:10,photoBytes:5242880,videoBytes:26214400,videoSeconds:120,pdfBytes:15728640,officeBytes:10485760,userStorageBytes:104857600,uploadsPerDay:100,videosPerDay:3};
            for (const key of numeric) if (value[key]>ceilings[key]) return fail(request,"The "+key+" limit cannot exceed the platform maximum.");
          }
          await env.DB.prepare("INSERT INTO chat_platform_settings(key,value_json,updated_by) VALUES(?,?,NULL) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=?")
            .bind(body.key,JSON.stringify(value),now()).run();
          await auditExternal(env,"super_admin","settings.updated","setting",body.key,"Communities global settings updated");
          return reply(request,{success:true});
        }
        return fail(request,"Ecosystem Super Admin Communities route not found.",404);
      }

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
        const limits=await getLimits(env);
        const memberships = await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE user_id=? AND status='active'").bind(user.id).first();
        if ((memberships?.total || 0) >= limits.maxGroupMemberships) return fail(request, "You have reached the "+limits.maxGroupMemberships+"-group membership limit.", 429);
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

      if (path==="/groups/invites/accept" && request.method==="POST") {
        const body=await parseBody(request);
        const token=String(body?.token||"");
        if (token.length<32||token.length>128) return fail(request,"Invitation link is invalid or expired.",400);
        const record=await env.DB.prepare("SELECT i.id,i.group_id,i.invited_email,g.name,g.status AS group_status FROM chat_group_invites i JOIN chat_groups g ON g.id=i.group_id WHERE i.token_hash=? AND i.accepted_at IS NULL AND i.expires_at>?")
          .bind(await sha256(token),now()).first();
        if (!record || record.group_status!=="active") return fail(request,"Invitation link is invalid or expired.",400);
        if (String(record.invited_email).toLowerCase()!==String(user.email).toLowerCase()) return fail(request,"Sign in with the email address this invitation was sent to.",403);
        const prior=await env.DB.prepare("SELECT status FROM chat_group_members WHERE group_id=? AND user_id=?").bind(record.group_id,user.id).first();
        if (prior?.status==="banned") return fail(request,"You are banned from this group.",403);
        if (prior?.status==="active") return fail(request,"You are already a member of this group.",409);
        const limits=await getLimits(env);
        const memberships=await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE user_id=? AND status='active'").bind(user.id).first();
        if ((memberships?.total||0)>=limits.maxGroupMemberships) return fail(request,"You have reached your group membership limit.",429);
        const groupCount=await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE group_id=? AND status='active'").bind(record.group_id).first();
        if ((groupCount?.total||0)>=limits.maxGroupMembers) return fail(request,"This group has reached its member limit.",429);
        await env.DB.batch([
          env.DB.prepare("UPDATE chat_group_invites SET accepted_at=? WHERE id=? AND accepted_at IS NULL").bind(now(),record.id),
          env.DB.prepare("INSERT INTO chat_group_members(group_id,user_id,role,status) VALUES(?,?,'member','active') ON CONFLICT(group_id,user_id) DO UPDATE SET role='member',status='active',joined_at=?").bind(record.group_id,user.id,now())
        ]);
        await audit(env,user.id,"group.invite.accepted","group",record.group_id);
        return reply(request,{success:true,group:{id:record.group_id,name:record.name}});
      }

      const groupMatch = path.match(/^\/groups\/([a-f0-9-]+)(?:\/(join|leave|messages|socket-ticket|reports|requests|pins|members|invites))?$/i);
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
          const limits=await getLimits(env);
          const total = await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE user_id=? AND status='active'").bind(user.id).first();
          if ((total?.total || 0) >= limits.maxGroupMemberships) return fail(request, "You have reached the "+limits.maxGroupMemberships+"-group membership limit.", 429);
          const groupCount=await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE group_id=? AND status='active'").bind(groupId).first();
          if ((groupCount?.total || 0) >= limits.maxGroupMembers) return fail(request,"This group has reached its member limit.",429);
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
          if (membership.muted_until && new Date(membership.muted_until).getTime() > Date.now()) return fail(request,"You are temporarily muted in this group.",403);
          const body = await parseBody(request);
          const text = String(body?.body || "").trim();
          const limits=await getLimits(env);
          if (!text || text.length > limits.maxMessageLength) return fail(request, "Message must contain 1–"+limits.maxMessageLength+" characters.");
          const rate = await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_messages WHERE sender_id=? AND created_at>=?")
            .bind(user.id,new Date(Date.now()-60_000).toISOString()).first();
          if ((rate?.total || 0) >= limits.messagesPerMinute) return fail(request, "Message limit reached. Please wait a moment.", 429);
          let replyToId = null;
          if (body?.replyToId) {
            const parent=await env.DB.prepare("SELECT id FROM chat_messages WHERE id=? AND group_id=? AND deleted_at IS NULL").bind(String(body.replyToId),groupId).first();
            if (parent) replyToId=parent.id;
          }
          const messageId = id();
          await env.DB.prepare("INSERT INTO chat_messages(id,group_id,sender_id,body,reply_to_id) VALUES(?,?,?,?,?)")
            .bind(messageId,groupId,user.id,text,replyToId).run();
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
          const target=operation==="add"?null:await env.DB.prepare("SELECT role,status FROM chat_group_members WHERE group_id=? AND user_id=?").bind(groupId,targetId).first();
          if (operation!=="add" && (!target || target.status!=="active")) return fail(request,"Group member not found.",404);
          if (operation==="add") {
            const email=String(body?.email||"").trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(request,"Enter the registered Communities email address.");
            const invited=await env.DB.prepare("SELECT id,email_verified_at,status FROM chat_users WHERE email=?").bind(email).first();
            const prior=invited?await env.DB.prepare("SELECT status FROM chat_group_members WHERE group_id=? AND user_id=?").bind(groupId,invited.id).first():null;
            if (prior?.status==="banned") return fail(request,"This student is banned from the group.",403);
            if (prior?.status==="active") return fail(request,"This student is already a member.",409);
            if (!invited || !invited.email_verified_at || invited.status!=="active") return fail(request,"That student must first create and verify a Communities account.",404);
            const limits=await getLimits(env);
            const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM chat_group_members WHERE group_id=? AND status='active'").bind(groupId).first();
            if ((count?.total||0)>=limits.maxGroupMembers) return fail(request,"This group has reached its member limit.",429);
            await env.DB.prepare("INSERT INTO chat_group_members(group_id,user_id,role,status) VALUES(?,?,'member','active') ON CONFLICT(group_id,user_id) DO UPDATE SET role='member',status='active',joined_at=?").bind(groupId,invited.id,now()).run();
            await audit(env,user.id,"member.added","user",invited.id,"Added by group moderator",{groupId});
            return reply(request,{success:true});
          }
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

        if (action === "invites" && request.method === "POST") {
          if (!membership || !["owner","admin","moderator"].includes(membership.role)) return fail(request,"Group moderator permission required.",403);
          if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return fail(request,"Email invitations are not configured yet.",503);
          const body=await parseBody(request);
          const email=String(body?.email||"").trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return fail(request,"Enter a valid invitation email address.");
          const existingMember=await env.DB.prepare("SELECT 1 FROM chat_group_members m JOIN chat_users u ON u.id=m.user_id WHERE m.group_id=? AND u.email=? AND m.status='active'").bind(groupId,email).first();
          if (existingMember) return fail(request,"This student is already a member.",409);
          const token=randomToken();
          await env.DB.prepare("INSERT INTO chat_group_invites(id,group_id,invited_email,invited_by,token_hash,expires_at) VALUES(?,?,?,?,?,?)")
            .bind(id(),groupId,email,user.id,await sha256(token),new Date(Date.now()+7*86400_000).toISOString()).run();
          try { await sendGroupInviteEmail(env,email,group.name,user.display_name,token); }
          catch(error) { return fail(request,"Invitation saved, but email could not be sent. "+error.message,502); }
          await audit(env,user.id,"group.invite.sent","group",groupId,"Invite sent to "+email);
          return reply(request,{success:true,message:"Group invitation sent."},201);
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
