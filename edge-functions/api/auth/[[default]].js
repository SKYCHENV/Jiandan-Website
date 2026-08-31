import { getStore } from "@edgeone/pages-blob";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const CODE_TTL_SECONDS = 10 * 60;
const CODE_RETRY_SECONDS = 60;
const VERIFY_WINDOW_SECONDS = 10 * 60;
const VERIFY_MAX_FAILURES = 8;
const ADMIN_TTL_SECONDS = 12 * 60 * 60;
const BUILD_BREVO_API_KEY =
  typeof __JIANDAN_BREVO_API_KEY__ === "string" ? __JIANDAN_BREVO_API_KEY__ : "";
const BUILD_BREVO_FROM_EMAIL =
  typeof __JIANDAN_BREVO_FROM_EMAIL__ === "string" ? __JIANDAN_BREVO_FROM_EMAIL__ : "";
const BUILD_BREVO_FROM_NAME =
  typeof __JIANDAN_BREVO_FROM_NAME__ === "string" ? __JIANDAN_BREVO_FROM_NAME__ : "";
const BUILD_ADMIN_EMAILS =
  typeof __JIANDAN_ADMIN_EMAILS__ === "string" ? __JIANDAN_ADMIN_EMAILS__ : "";
const encoder = new TextEncoder();

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function failure(status, code, message) {
  return json(status, { ok: false, error: { code, message } });
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digest(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function sameBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function randomCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

async function codeHash(secret, email, code) {
  return base64url(await hmac(secret, `otp|${email}|${code}`));
}

async function signToken(secret, payload) {
  const encoded = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = base64url(await hmac(secret, `token|${encoded}`));
  return `${encoded}.${signature}`;
}

async function readToken(secret, token, expectedType) {
  const [encoded, signature, extra] = String(token || "").split(".");
  if (!encoded || !signature || extra) return null;
  const expected = await hmac(secret, `token|${encoded}`);
  let supplied;
  try {
    supplied = decodeBase64url(signature);
  } catch {
    return null;
  }
  if (!sameBytes(expected, supplied)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(encoded)));
    if (payload.type !== expectedType || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function authStore(env) {
  if (env.AUTH_KV) return env.AUTH_KV;
  const store = getStore("jiandan-auth");
  return {
    get: (key) => store.get(key, { consistency: "strong" }),
    put: (key, value) => store.set(key, value),
    delete: (key) => store.delete(key),
    list: (options) => store.list({ ...options, consistency: "strong" }),
  };
}

async function getRecord(store, key) {
  const raw = await store.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function putRecord(store, key, value) {
  await store.put(key, JSON.stringify(value));
}

function adminEmails(env) {
  return new Set(
    String(env.ADMIN_EMAILS || BUILD_ADMIN_EMAILS)
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

function isAdmin(env, email) {
  return adminEmails(env).has(email);
}

async function getUser(store, email) {
  return getRecord(store, `user_${await digest(email)}`);
}

async function upsertUser(store, email, device, now) {
  const key = `user_${await digest(email)}`;
  const existing = await getRecord(store, key);
  const user = {
    email,
    created_at: Number(existing?.created_at || now),
    last_login_at: now,
    login_count: Number(existing?.login_count || 0) + 1,
    status: existing?.status === "blocked" ? "blocked" : "active",
    device_name: device.device_name,
    device_id: device.device_id,
    updated_at: now,
  };
  await putRecord(store, key, user);
  return user;
}

async function consumeCode(env, store, email, code) {
  const now = Math.floor(Date.now() / 1000);
  const emailHash = await digest(email);
  const attemptsKey = `verify_attempts_${emailHash}`;
  const attempts = (await getRecord(store, attemptsKey)) || { started_at: now, failures: 0 };
  if (now - Number(attempts.started_at || 0) >= VERIFY_WINDOW_SECONDS) {
    attempts.started_at = now;
    attempts.failures = 0;
  }
  if (Number(attempts.failures || 0) >= VERIFY_MAX_FAILURES) {
    return failure(429, "too_many_attempts", "验证码尝试次数过多，请稍后再试");
  }
  const codeKey = `code_${emailHash}`;
  const pendingCode = await getRecord(store, codeKey);
  const suppliedHash = await codeHash(env.AUTH_SECRET, email, code);
  const valid = pendingCode?.hash && pendingCode.expires_at > now && pendingCode.hash === suppliedHash;
  if (!valid) {
    attempts.failures = Number(attempts.failures || 0) + 1;
    await putRecord(store, attemptsKey, attempts);
    return failure(401, "invalid_code", "验证码错误或已过期");
  }
  await putRecord(store, codeKey, { consumed_at: now });
  await putRecord(store, attemptsKey, { started_at: now, failures: 0 });
  return null;
}

async function sendCode(env, email, code) {
  if (env.AUTH_DEV_RETURN_CODE === "1") return;
  const apiKey = env.BREVO_API_KEY || BUILD_BREVO_API_KEY;
  const fromEmail = env.BREVO_FROM_EMAIL || BUILD_BREVO_FROM_EMAIL;
  const fromName = env.BREVO_FROM_NAME || BUILD_BREVO_FROM_NAME || "剪蛋";
  if (!apiKey || !fromEmail) throw new Error("mail_not_configured");

  const request = env.AUTH_FETCH || fetch;
  const response = await request("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email }],
      subject: `${code} 是你的剪蛋验证码`,
      textContent: `你的剪蛋验证码是 ${code}。验证码 10 分钟内有效。若非本人操作，请忽略此邮件。`,
      htmlContent: `<div style="font-family:Arial,sans-serif;color:#111;max-width:520px;margin:auto;padding:32px"><h1 style="font-size:24px">登录剪蛋</h1><p>你的验证码是：</p><p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0A84FF">${code}</p><p style="color:#666">验证码 10 分钟内有效。若非本人操作，请忽略此邮件。</p></div>`,
      tags: ["login-code"],
    }),
  });
  if (!response.ok) throw new Error(`mail_${response.status}`);
  const result = await response.json();
  if (!result?.messageId) {
    console.error("Brevo did not return a message ID");
    throw new Error("mail_provider");
  }
}

async function issueSession(env, email, deviceId, generation) {
  const now = Math.floor(Date.now() / 1000);
  const common = { email, device_id: deviceId, generation };
  const accessExpiresAt = now + ACCESS_TTL_SECONDS;
  const refreshExpiresAt = now + REFRESH_TTL_SECONDS;
  return {
    email,
    device_id: deviceId,
    access_token: await signToken(env.AUTH_SECRET, { ...common, type: "access", iat: now, exp: accessExpiresAt }),
    refresh_token: await signToken(env.AUTH_SECRET, { ...common, type: "refresh", iat: now, exp: refreshExpiresAt }),
    access_expires_at: accessExpiresAt,
    refresh_expires_at: refreshExpiresAt,
  };
}

async function currentDevice(env, email) {
  return getRecord(authStore(env), `device_${await digest(email)}`);
}

async function requestCode(request, env) {
  const body = await request.json();
  const email = normalizeEmail(body.email);
  if (!email) return failure(400, "invalid_email", "请输入有效的邮箱地址");
  const now = Math.floor(Date.now() / 1000);
  const emailHash = await digest(email);
  const rateKey = `code_rate_${emailHash}`;
  const codeKey = `code_${emailHash}`;
  const store = authStore(env);
  const previous = await getRecord(store, rateKey);
  if (previous && now - Number(previous.sent_at || 0) < CODE_RETRY_SECONDS) {
    return failure(429, "rate_limited", `请在 ${CODE_RETRY_SECONDS - (now - previous.sent_at)} 秒后重试`);
  }
  const code = randomCode();
  await sendCode(env, email, code);
  await putRecord(store, codeKey, {
    hash: await codeHash(env.AUTH_SECRET, email, code),
    expires_at: now + CODE_TTL_SECONDS,
  });
  await putRecord(store, rateKey, { sent_at: now });
  const data = { retry_after: CODE_RETRY_SECONDS };
  if (env.AUTH_DEV_RETURN_CODE === "1") data.dev_code = code;
  return json(200, { ok: true, data });
}

async function verifyCode(request, env) {
  const body = await request.json();
  const email = normalizeEmail(body.email);
  const code = String(body.code || "");
  const deviceId = String(body.device_id || "");
  if (!email || !/^\d{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
    return failure(400, "invalid_request", "邮箱、验证码或设备信息无效");
  }
  const now = Math.floor(Date.now() / 1000);
  const store = authStore(env);
  const emailHash = await digest(email);
  const existingUser = await getUser(store, email);
  if (existingUser?.status === "blocked") return failure(403, "account_blocked", "此账号已被停用");
  if (existingUser?.status === "deleted") return failure(403, "account_deleted", "此账号已被注销");
  const codeFailure = await consumeCode(env, store, email, code);
  if (codeFailure) return codeFailure;
  const existing = await currentDevice(env, email);
  const generation = Number(existing?.generation || 0) + 1;
  const device = {
    device_id: deviceId,
    device_name: String(body.device_name || "Windows PC").slice(0, 80),
    generation,
    updated_at: now,
  };
  await putRecord(store, `device_${emailHash}`, device);
  await upsertUser(store, email, device, now);
  return json(200, { ok: true, data: { session: await issueSession(env, email, deviceId, generation) } });
}

async function requireCurrentSession(env, token, type) {
  const payload = await readToken(env.AUTH_SECRET, token, type);
  if (!payload) return null;
  const current = await currentDevice(env, payload.email);
  if (!current || current.device_id !== payload.device_id || Number(current.generation) !== Number(payload.generation)) return null;
  const user = await getUser(authStore(env), payload.email);
  if (user && user.status !== "active") return null;
  return payload;
}

async function requestAdminCode(request, env) {
  const body = await request.json();
  const email = normalizeEmail(body.email);
  if (!email || !isAdmin(env, email)) return failure(403, "admin_forbidden", "此邮箱没有管理员权限");
  return requestCode(new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  }), env);
}

async function verifyAdmin(request, env) {
  const body = await request.json();
  const email = normalizeEmail(body.email);
  const code = String(body.code || "");
  if (!email || !/^\d{6}$/.test(code)) return failure(400, "invalid_request", "邮箱或验证码无效");
  if (!isAdmin(env, email)) return failure(403, "admin_forbidden", "此邮箱没有管理员权限");
  const codeFailure = await consumeCode(env, authStore(env), email, code);
  if (codeFailure) return codeFailure;
  const now = Math.floor(Date.now() / 1000);
  const token = await signToken(env.AUTH_SECRET, { type: "admin", email, iat: now, exp: now + ADMIN_TTL_SECONDS });
  return json(200, { ok: true, data: { token, email, expires_at: now + ADMIN_TTL_SECONDS } });
}

async function requireAdmin(request, env) {
  const body = await request.json();
  const payload = await readToken(env.AUTH_SECRET, body.token, "admin");
  return payload && isAdmin(env, payload.email) ? { body, payload } : null;
}

async function listUsers(store) {
  const result = await store.list({ prefix: "user_" });
  const users = await Promise.all((result.blobs || []).map((blob) => getRecord(store, blob.key)));
  return users.filter(Boolean).sort((left, right) => Number(right.last_login_at || 0) - Number(left.last_login_at || 0));
}

async function adminOverview(request, env) {
  const admin = await requireAdmin(request, env);
  if (!admin) return failure(401, "admin_session_invalid", "管理员登录已失效");
  const users = await listUsers(authStore(env));
  const active = users.filter((user) => user.status === "active").length;
  const blocked = users.filter((user) => user.status === "blocked").length;
  return json(200, {
    ok: true,
    data: {
      admin_email: admin.payload.email,
      stats: { total: users.length, active, blocked, deleted: users.length - active - blocked },
      users: users.map(({ device_id: _deviceId, ...user }) => user),
    },
  });
}

async function updateUserStatus(request, env) {
  const admin = await requireAdmin(request, env);
  if (!admin) return failure(401, "admin_session_invalid", "管理员登录已失效");
  const email = normalizeEmail(admin.body.email);
  const status = String(admin.body.status || "");
  if (!email || !["active", "blocked", "deleted"].includes(status)) {
    return failure(400, "invalid_request", "账号或状态无效");
  }
  if (isAdmin(env, email)) return failure(400, "protected_account", "管理员账号不能在此处修改");
  const store = authStore(env);
  const user = await getUser(store, email);
  if (!user) return failure(404, "user_not_found", "找不到该账号");
  if (user.status === "deleted" && status !== "deleted") {
    return failure(400, "account_deleted", "已注销账号不能恢复");
  }
  const now = Math.floor(Date.now() / 1000);
  await putRecord(store, `user_${await digest(email)}`, { ...user, status, updated_at: now });
  if (status !== "active") {
    const current = await currentDevice(env, email);
    await putRecord(store, `device_${await digest(email)}`, {
      device_id: status,
      generation: Number(current?.generation || 0) + 1,
      updated_at: now,
    });
  }
  return json(200, { ok: true, data: { email, status } });
}

async function validateSession(request, env) {
  const body = await request.json();
  const payload = await requireCurrentSession(env, body.access_token, "access");
  if (!payload) return failure(401, "session_invalid", "登录已失效，请重新验证邮箱");
  return json(200, { ok: true, data: { email: payload.email } });
}

async function refreshSession(request, env) {
  const body = await request.json();
  const payload = await requireCurrentSession(env, body.refresh_token, "refresh");
  if (!payload || payload.device_id !== body.device_id) {
    return failure(401, "session_invalid", "此账号已在其他设备登录，请重新验证邮箱");
  }
  return json(200, {
    ok: true,
    data: { session: await issueSession(env, payload.email, payload.device_id, payload.generation) },
  });
}

async function logout(request, env) {
  const body = await request.json();
  const payload = await readToken(env.AUTH_SECRET, body.refresh_token, "refresh");
  if (payload) {
    const current = await currentDevice(env, payload.email);
    if (current?.device_id === payload.device_id && Number(current.generation) === Number(payload.generation)) {
      await putRecord(authStore(env), `device_${await digest(payload.email)}`, {
        device_id: "logged_out",
        generation: Number(current.generation) + 1,
        updated_at: Math.floor(Date.now() / 1000),
      });
    }
  }
  return json(200, { ok: true, data: {} });
}

export async function onRequestPost({ request, env }) {
  if (!env.AUTH_SECRET) return failure(503, "service_unavailable", "登录服务尚未完成配置");
  const endpoint = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  try {
    if (endpoint === "request-code") return await requestCode(request, env);
    if (endpoint === "verify") return await verifyCode(request, env);
    if (endpoint === "session") return await validateSession(request, env);
    if (endpoint === "refresh") return await refreshSession(request, env);
    if (endpoint === "logout") return await logout(request, env);
    if (endpoint === "admin-request-code") return await requestAdminCode(request, env);
    if (endpoint === "admin-verify") return await verifyAdmin(request, env);
    if (endpoint === "admin-overview") return await adminOverview(request, env);
    if (endpoint === "admin-update-user") return await updateUserStatus(request, env);
    return failure(404, "not_found", "接口不存在");
  } catch (error) {
    console.error("auth request failed", error);
    if (error?.message === "mail_not_configured") {
      return failure(503, "mail_not_configured", "验证码邮件服务尚未完成配置");
    }
    if (/^mail_(?:\d{3}|provider)$/.test(error?.message || "")) {
      return failure(503, "mail_delivery_unavailable", "验证码邮件暂时无法发送");
    }
    return failure(500, "service_unavailable", "登录服务暂时不可用");
  }
}

export function onRequest() {
  return failure(405, "method_not_allowed", "请求方法不受支持");
}
