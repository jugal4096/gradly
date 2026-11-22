import { useEffect, useRef, useState, type FormEvent } from "react";
import "./CommunitiesPanel.css";

const API = import.meta.env.VITE_COMMUNITIES_API_URL || "https://gradly-communities-api.jugalpkhr.workers.dev";
const TOKEN_KEY = "gradly_communities_session";

type User = { id: string; email: string; displayName: string };
type Group = { id: string; name: string; description: string; category: string; visibility: string; member_count?: number; unread_count?: number; is_member?: number; role?: string };
type Message = { id: string; group_id: string; sender_id: string; sender_name: string; body: string; created_at: string; edited_at?: string | null; deleted_at?: string | null; reply_to_id?: string | null };

async function api(path: string, token?: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(API + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export default function CommunitiesPanel() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [mine, setMine] = useState<Group[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Group | null>(null);
  const selectedGroupId = selected?.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [pins, setPins] = useState<{id:string;body:string;sender_name:string}[]>([]);
  const [members, setMembers] = useState<{id:string;display_name:string;role:string;muted_until?:string|null}[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reactions, setReactions] = useState<Record<string,{reaction:string;total:number}[]>>({});
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState("");
  const [socketState, setSocketState] = useState("Connecting");
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupCategory, setGroupCategory] = useState("study");
  const [groupVisibility, setGroupVisibility] = useState("public");
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const composerRef = useRef<HTMLInputElement | null>(null);

  const loadGroups = async (session = token) => {
    const [all, joined] = await Promise.all([api("/groups?q=" + encodeURIComponent(query), session), api("/groups/mine", session)]);
    setGroups(all.groups || []);
    setMine(joined.groups || []);
    if (selected) {
      const refreshed = (joined.groups || []).find((g: Group) => g.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api("/auth/me", token)
      .then((data) => { if (!cancelled) { setUser(data.user); setError(""); } })
      .catch(() => { if (!cancelled) { localStorage.removeItem(TOKEN_KEY); setToken(""); setUser(null); } });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    api("/groups", token).then((data) => { if (!cancelled) setGroups(data.groups || []); }).catch((e) => { if (!cancelled) setError(e.message); });
    api("/groups/mine", token).then((data) => { if (!cancelled) setMine(data.groups || []); }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, user]);

  useEffect(() => {
    if (!token || !selectedGroupId) return;
    let stopped = false;
    let pollTimer: number | undefined;
    let socket: WebSocket | null = null;
    const refresh = async () => {
      try {
        const [data,pinData,memberData] = await Promise.all([
          api(`/groups/${selectedGroupId}/messages?limit=75`, token),
          api(`/groups/${selectedGroupId}/pins`, token),
          api(`/groups/${selectedGroupId}/members`, token)
        ]);
        if (!stopped) {
          setMessages(data.messages || []);
          setPins(pinData.pins || []);
          setMembers(memberData.members || []);
        }
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
    };
    const refreshTimer: number = window.setInterval(() => { void refresh(); }, 12000);
    const connect = async () => {
      try {
        const result = await api(`/groups/${selectedGroupId}/socket-ticket`, token, { method: "POST", body: "{}" });
        if (stopped) return;
        const wsUrl = API.replace(/^http/, "ws") + `/groups/${selectedGroupId}/live?ticket=${encodeURIComponent(result.ticket)}`;
        socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        socket.onopen = () => { if (!stopped) setSocketState("Live"); };
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "message" && data.message) {
              setMessages((current) => current.some((m) => m.id === data.message.id) ? current : [...current, data.message]);
            } else if (data.type === "error") setError(data.error || "Chat error");
          } catch { /* ignore malformed frames */ }
        };
        socket.onerror = () => { if (!stopped) setSocketState("Reconnecting"); };
        socket.onclose = () => {
          if (!stopped) {
            setSocketState("Reconnecting");
            if (!pollTimer) pollTimer = window.setInterval(refresh, 4000);
          }
        };
      } catch {
        if (!stopped) {
          setSocketState("Polling");
          pollTimer = window.setInterval(refresh, 4000);
        }
      }
    };
    setMessages([]);
    setSocketState("Connecting");
    void refresh();
    void connect();
    return () => {
      stopped = true;
      if (pollTimer) window.clearInterval(pollTimer);
      if (refreshTimer) window.clearInterval(refreshTimer);
      socket?.close();
      socketRef.current = null;
    };
  }, [token, selectedGroupId]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setAuthBusy(true); setError(""); setNotice("");
    try {
      if (authMode === "register") {
        const data = await api("/auth/register", undefined, { method: "POST", body: JSON.stringify({ displayName: name, email, password }) });
        setNotice(data.message || "Check your email to verify your account.");
        setAuthMode("login");
      } else {
        const data = await api("/auth/login", undefined, { method: "POST", body: JSON.stringify({ email, password }) });
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token); setUser(data.user); setNotice("Welcome to Gradly Communities.");
      }
    } catch (e) { setError((e as Error).message); }
    finally { setAuthBusy(false); }
  };

  const signOut = async () => {
    try { await api("/auth/logout", token, { method: "POST", body: "{}" }); } catch { /* local sign-out still clears the session */ }
    localStorage.removeItem(TOKEN_KEY); setToken(""); setUser(null); setSelected(null); setMessages([]);
  };

  const createGroup = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await api("/groups", token, { method: "POST", body: JSON.stringify({ name: groupName, description: groupDescription, category: groupCategory, visibility: groupVisibility }) });
      setShowCreate(false); setGroupName(""); setGroupDescription("");
      await loadGroups();
      setSelected(data.group);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const joinGroup = async (group: Group) => {
    setBusy(true); setError("");
    try {
      const data = await api(`/groups/${group.id}/join`, token, { method: "POST", body: "{}" });
      if (data.requestPending) setNotice("Join request sent. A group moderator must approve it.");
      else { setNotice("You joined the group."); setSelected(group); }
      await loadGroups();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selected) return;
    setBusy(true); setError("");
    try {
      if (editingId) {
        await api(`/messages/${editingId}`, token, { method: "PATCH", body: JSON.stringify({ body }) });
        setEditingId("");
        const data = await api(`/groups/${selectedGroupId}/messages?limit=75`, token);
        setMessages(data.messages || []);
      } else if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "message", body }));
      } else {
        const data = await api(`/groups/${selectedGroupId}/messages`, token, { method: "POST", body: JSON.stringify({ body }) });
        setMessages((current) => [...current, data.message]);
      }
      setDraft("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); composerRef.current?.focus(); }
  };

  const deleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await api(`/messages/${messageId}`, token, { method: "DELETE" });
      setMessages((current) => current.map((m) => m.id === messageId ? { ...m, body: "This message was deleted.", deleted_at: new Date().toISOString() } : m));
    } catch (e) { setError((e as Error).message); }
  };

  const leaveGroup = async () => {
    if (!selected || !window.confirm("Leave this group?")) return;
    try {
      await api(`/groups/${selectedGroupId}/leave`, token, { method: "POST", body: "{}" });
      setSelected(null); setMessages([]); await loadGroups();
    } catch (e) { setError((e as Error).message); }
  };

  if (!user) return (
    <section className="gc-shell">
      <div className="gc-auth-card">
        <div className="gc-brand-mark">G</div>
        <span className="gc-eyebrow">GRADLY · LEARN TOGETHER</span>
        <h2>{authMode === "register" ? "Create your community account" : "Welcome to Communities"}</h2>
        <p className="gc-muted">A shared space for students to discuss coursework, exchange learning material and find their study circle.</p>
        <form className="gc-form" onSubmit={handleAuth}>
          {authMode === "register" && <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required placeholder="Display name" /></label>}
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} maxLength={128} required placeholder="At least 10 characters" /></label>
          <button className="gc-primary" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "register" ? "Create account" : "Sign in"} <span>→</span></button>
        </form>
        <button className="gc-text-button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); setNotice(""); }}>
          {authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        {notice && <p className="gc-notice">{notice}</p>}
        {error && <p className="gc-error">{error}</p>}
        <small className="gc-legal">Your Communities account is separate from your Gradly student sign-in. Email verification is required.</small>
      </div>
    </section>
  );

  return (
    <section className="gc-shell">
      <div className="gc-topbar">
        <div><span className="gc-eyebrow">GRADLY · COMMUNITIES</span><h2>Find your study circle.</h2><p>Learn together, share ideas and keep your class connected.</p></div>
        <div className="gc-user-chip"><span>{user.displayName.slice(0,1).toUpperCase()}</span><div><b>{user.displayName}</b><small>{user.email}</small></div><button onClick={signOut}>Sign out</button></div>
      </div>
      {notice && <div className="gc-notice gc-banner">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {error && <div className="gc-error gc-banner">{error}<button onClick={() => setError("")}>×</button></div>}
      <div className="gc-layout">
        <aside className="gc-sidebar">
          <div className="gc-sidebar-head"><div><span className="gc-eyebrow">YOUR SPACE</span><h3>My groups</h3></div><button className="gc-add" onClick={() => setShowCreate(!showCreate)} aria-label="Create group">＋</button></div>
          {mine.length ? mine.map((group) => <button key={group.id} className={`gc-group-link ${selected?.id === group.id ? "active" : ""}`} onClick={() => setSelected(group)}><span className="gc-group-avatar">{group.name.slice(0,1).toUpperCase()}</span><span><b>{group.name}</b><small>{group.member_count || 1} members · {group.role}</small></span></button>) : <p className="gc-empty-small">Your joined groups will appear here.</p>}
          <div className="gc-discover-head"><span className="gc-eyebrow">EXPLORE</span><h3>Discover groups</h3></div>
          <input className="gc-search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadGroups(); }} placeholder="Search communities…" />
          <button className="gc-search-button" onClick={() => void loadGroups()}>Search groups</button>
          <div className="gc-discover-list">
            {groups.filter((g) => !mine.some((m) => m.id === g.id)).map((group) => <div className="gc-discover-item" key={group.id}><div><b>{group.name}</b><small>{group.category} · {group.member_count || 0} members</small></div><button disabled={busy} onClick={() => void joinGroup(group)}>{group.visibility === "public" ? "Join" : "Request"}</button></div>)}
            {!groups.length && <p className="gc-empty-small">No communities found yet. Create the first one.</p>}
          </div>
        </aside>

        <main className="gc-main">
          {showCreate && <form className="gc-create-card" onSubmit={createGroup}>
            <div className="gc-card-heading"><div><span className="gc-eyebrow">START SOMETHING GOOD</span><h3>Create a community</h3></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>
            <label>Group name<input value={groupName} onChange={(e) => setGroupName(e.target.value)} required minLength={3} maxLength={70} placeholder="e.g. GECA IT · Semester 7" /></label>
            <label>Description<textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} maxLength={500} rows={2} placeholder="What will this group be about?" /></label>
            <div className="gc-inline-fields"><label>Category<select value={groupCategory} onChange={(e) => setGroupCategory(e.target.value)}><option value="study">Study group</option><option value="college">College</option><option value="department">Department</option><option value="semester">Semester</option><option value="subject">Subject</option><option value="other">Other</option></select></label><label>Privacy<select value={groupVisibility} onChange={(e) => setGroupVisibility(e.target.value)}><option value="public">Public</option><option value="private">Private · approval required</option></select></label></div>
            <button className="gc-primary" disabled={busy}>{busy ? "Creating…" : "Create group →"}</button>
          </form>}

          {selected ? <div className="gc-chat-card">
            <header className="gc-chat-header"><div className="gc-group-avatar large">{selected.name.slice(0,1).toUpperCase()}</div><div><span className="gc-eyebrow">{selected.category} COMMUNITY</span><h3>{selected.name}</h3><p>{selected.description || "A place to learn together."}</p></div><div className="gc-chat-status"><i className={socketState === "Live" ? "online" : ""}/>{socketState}<button onClick={() => void leaveGroup()}>Leave</button></div></header>
            <div className="gc-chat-messages">
              {messages.length ? messages.map((message) => <article key={message.id} className={`gc-message ${message.sender_id === user.id ? "mine" : ""}`}><div className="gc-message-meta"><b>{message.sender_name}</b><time>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{message.edited_at ? " · edited" : ""}</time></div><p>{message.deleted_at ? "This message was deleted." : message.body}</p>{!message.deleted_at && message.sender_id === user.id && <div className="gc-message-actions"><button onClick={() => { setEditingId(message.id); setDraft(message.body); composerRef.current?.focus(); }}>Edit</button><button onClick={() => void deleteMessage(message.id)}>Delete</button></div>}</article>) : <div className="gc-chat-empty"><span>✳</span><h3>Start the conversation</h3><p>Ask a question, share an idea or help someone understand a topic.</p></div>}
            </div>
            <form className="gc-compose" onSubmit={sendMessage}><input ref={composerRef} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} placeholder={editingId ? "Edit your message…" : "Write a message to your group…"} /><button className="gc-primary" disabled={busy || !draft.trim()}>{editingId ? "Save" : "Send"} →</button>{editingId && <button type="button" className="gc-cancel-edit" onClick={() => { setEditingId(""); setDraft(""); }}>Cancel</button>}</form>
            <div className="gc-storage-note"><b>Media & study resources</b><span>Photo, video and document sharing will be enabled after the private storage bucket is configured.</span></div>
          </div> : <div className="gc-welcome-card"><div className="gc-welcome-orbit">✳</div><span className="gc-eyebrow">YOUR NEXT CHAPTER, TOGETHER</span><h3>Good ideas grow in good company.</h3><p>Choose one of your groups, discover a community or create a study space for your classmates.</p><button className="gc-primary" onClick={() => setShowCreate(true)}>Create your first group →</button></div>}
        </main>
      </div>
    </section>
  );
}
