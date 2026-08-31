import {useEffect, useMemo, useState} from "react";
import {
  ArrowClockwise,
  CheckCircle,
  EnvelopeSimple,
  MagnifyingGlass,
  Prohibit,
  ShieldCheck,
  SignOut,
  Trash,
  UserCheck,
  Users,
} from "@phosphor-icons/react";

const storageKey = "jiandan-admin-session";
const publicPath = (path) => `${import.meta.env.BASE_URL}${path}`;
const previewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");
const previewOverview = {
  admin_email: "owner@example.com",
  stats: {total: 3, active: 1, blocked: 1, deleted: 1},
  users: [
    {email: "creator@example.com", status: "active", device_name: "DESKTOP-STUDIO", created_at: 1788100200, last_login_at: 1788179400, login_count: 12},
    {email: "team@example.com", status: "blocked", device_name: "Editing PC", created_at: 1787927400, last_login_at: 1788013800, login_count: 4},
    {email: "former@example.com", status: "deleted", device_name: "Windows PC", created_at: 1787581800, last_login_at: 1787668200, login_count: 2},
  ],
};

async function api(endpoint, payload) {
  if (previewMode) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (endpoint === "admin-overview") return previewOverview;
    if (endpoint === "admin-update-user") return {email: payload.email, status: payload.status};
  }
  const response = await fetch(`/api/auth/${endpoint}`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    const error = new Error(body.error?.message || "请求失败，请稍后重试");
    error.code = body.error?.code || "request_failed";
    throw error;
  }
  return body.data;
}

function readSession() {
  if (previewMode) return {token: "preview", email: "owner@example.com", expires_at: 4_102_444_800};
  try {
    const session = JSON.parse(localStorage.getItem(storageKey));
    return session?.token && session.expires_at * 1000 > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value * 1000));
}

function AdminLogin({onAuthenticated}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("admin-request-code", {email});
      setSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await api("admin-verify", {email, code});
      localStorage.setItem(storageKey, JSON.stringify(session));
      onAuthenticated(session);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <main className="admin-login-shell">
    <a className="admin-brand" href="/" aria-label="返回剪蛋官网">
      <img src={publicPath("assets/jiandan.png")} alt="" />
      <span>剪蛋</span>
    </a>
    <section className="admin-login-panel">
      <span className="admin-login-icon"><ShieldCheck weight="duotone" /></span>
      <p className="admin-kicker">JIANDAN ADMIN</p>
      <h1>管理后台</h1>
      <p className="admin-login-copy">使用管理员邮箱验证身份</p>
      {!sent ? <form onSubmit={requestCode}>
        <label htmlFor="admin-email">邮箱</label>
        <div className="admin-field"><EnvelopeSimple /><input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@example.com" /></div>
        <button className="admin-primary" disabled={busy}>{busy ? "正在发送" : "发送验证码"}</button>
      </form> : <form onSubmit={verify}>
        <label htmlFor="admin-code">验证码已发送至 {email}</label>
        <input className="admin-code" id="admin-code" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} autoFocus required placeholder="000000" />
        <button className="admin-primary" disabled={busy || code.length !== 6}>{busy ? "正在验证" : "进入后台"}</button>
        <button className="admin-link-button" type="button" onClick={() => {setSent(false); setCode(""); setError("");}}>更换邮箱</button>
      </form>}
      {error && <p className="admin-error" role="alert">{error}</p>}
    </section>
  </main>;
}

function StatusBadge({status}) {
  const labels = {active: "正常", blocked: "已封禁", deleted: "已注销"};
  return <span className={`admin-status admin-status--${status}`}>{labels[status] || status}</span>;
}

function ConfirmDialog({action, busy, onCancel, onConfirm}) {
  if (!action) return null;
  const deleting = action.status === "deleted";
  return <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <section className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-dialog-title">
      <span className={deleting ? "admin-dialog-icon admin-dialog-icon--danger" : "admin-dialog-icon"}>{deleting ? <Trash /> : <Prohibit />}</span>
      <h2 id="admin-dialog-title">{deleting ? "注销这个账户？" : action.status === "blocked" ? "封禁这个账户？" : "解除账户封禁？"}</h2>
      <p>{action.email}</p>
      <small>{deleting ? "账户将无法再次登录，记录会保留用于审计。" : action.status === "blocked" ? "该用户当前的剪蛋会话会立即失效。" : "该用户可以重新获取验证码并登录。"}</small>
      <div className="admin-dialog-actions">
        <button onClick={onCancel} disabled={busy}>取消</button>
        <button className={deleting ? "admin-danger" : "admin-primary"} onClick={onConfirm} disabled={busy}>{busy ? "处理中" : "确认"}</button>
      </div>
    </section>
  </div>;
}

function Dashboard({session, onLogout}) {
  const [overview, setOverview] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await api("admin-overview", {token: session.token}));
    } catch (requestError) {
      if (requestError.code === "admin_session_invalid") onLogout();
      else setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {load();}, []);
  const users = useMemo(() => (overview?.users || []).filter((user) => user.email.includes(query.trim().toLowerCase())), [overview, query]);

  const applyAction = async () => {
    setActionBusy(true);
    try {
      await api("admin-update-user", {token: session.token, email: action.email, status: action.status});
      setAction(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const stats = overview?.stats || {total: 0, active: 0, blocked: 0, deleted: 0};
  return <div className="admin-app">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/"><img src={publicPath("assets/jiandan.png")} alt="" /><span>剪蛋</span></a>
      <nav><a className="is-active" href="/admin"><Users weight="fill" />账户</a></nav>
      <div className="admin-account"><span>{session.email}</span><button onClick={onLogout} aria-label="退出后台" title="退出后台"><SignOut /></button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-header"><div><p className="admin-kicker">ACCOUNTS</p><h1>账户管理</h1><p>查看剪蛋登录账户与设备状态</p></div><button className="admin-icon-button" onClick={load} disabled={loading} aria-label="刷新" title="刷新"><ArrowClockwise className={loading ? "is-spinning" : ""} /></button></header>
      {error && <div className="admin-banner" role="alert">{error}</div>}
      <section className="admin-stats" aria-label="账户统计">
        <article><span><Users /></span><div><small>全部账户</small><strong>{stats.total}</strong></div></article>
        <article><span><UserCheck /></span><div><small>正常</small><strong>{stats.active}</strong></div></article>
        <article><span><Prohibit /></span><div><small>已封禁</small><strong>{stats.blocked}</strong></div></article>
        <article><span><Trash /></span><div><small>已注销</small><strong>{stats.deleted}</strong></div></article>
      </section>
      <section className="admin-users">
        <div className="admin-users-toolbar"><div><h2>用户</h2><span>{overview?.users?.length || 0} 个账户</span></div><label className="admin-search"><MagnifyingGlass /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索邮箱" /></label></div>
        <div className="admin-table-wrap">
          <table><thead><tr><th>账户</th><th>状态</th><th>设备</th><th>首次登录</th><th>最近登录</th><th>次数</th><th><span className="sr-only">操作</span></th></tr></thead>
            <tbody>{users.map((user) => <tr key={user.email}>
              <td data-label="账户"><strong>{user.email}</strong></td><td data-label="状态"><StatusBadge status={user.status} /></td><td data-label="设备">{user.device_name || "-"}</td><td data-label="首次登录">{formatTime(user.created_at)}</td><td data-label="最近登录">{formatTime(user.last_login_at)}</td><td data-label="次数">{user.login_count || 0}</td>
              <td className="admin-row-actions">{user.status !== "deleted" && <><button onClick={() => setAction({email: user.email, status: user.status === "blocked" ? "active" : "blocked"})} title={user.status === "blocked" ? "解封" : "封禁"}>{user.status === "blocked" ? <CheckCircle /> : <Prohibit />}</button><button className="is-danger" onClick={() => setAction({email: user.email, status: "deleted"})} title="注销"><Trash /></button></>}</td>
            </tr>)}</tbody>
          </table>
          {!loading && users.length === 0 && <div className="admin-empty"><Users /><strong>{query ? "没有匹配的账户" : "还没有用户"}</strong><p>{query ? "换个邮箱关键词试试" : "用户首次登录剪蛋后会显示在这里"}</p></div>}
          {loading && <div className="admin-empty"><ArrowClockwise className="is-spinning" /><strong>正在读取账户</strong></div>}
        </div>
      </section>
    </main>
    <ConfirmDialog action={action} busy={actionBusy} onCancel={() => setAction(null)} onConfirm={applyAction} />
  </div>;
}

export function AdminApp() {
  const [session, setSession] = useState(readSession);
  const logout = () => {localStorage.removeItem(storageKey); setSession(null);};
  return session ? <Dashboard session={session} onLogout={logout} /> : <AdminLogin onAuthenticated={setSession} />;
}
