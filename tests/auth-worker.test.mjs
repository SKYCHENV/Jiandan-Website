import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost } from "../edge-functions/api/auth/[[default]].js";

class MemoryKv {
  constructor() {
    this.values = new Map();
  }

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }

  async list({ prefix = "" } = {}) {
    return { blobs: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
  }

  clearRateLimits() {
    for (const key of this.values.keys()) {
      if (key.startsWith("code_rate_")) this.values.delete(key);
    }
  }
}

function environment() {
  return {
    AUTH_SECRET: "test-secret-that-is-long-enough-for-auth-tests",
    AUTH_DEV_RETURN_CODE: "1",
    ADMIN_EMAILS: "owner@example.com",
    AUTH_KV: new MemoryKv(),
  };
}

async function post(env, endpoint, body) {
  const response = await onRequestPost({
    env,
    request: new Request(`https://example.test/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  return { status: response.status, body: await response.json() };
}

test("email code creates a restorable session", async () => {
  const env = environment();
  const requested = await post(env, "request-code", { email: "Hello@Example.com" });
  assert.equal(requested.status, 200);
  assert.match(requested.body.data.dev_code, /^\d{6}$/);

  const verified = await post(env, "verify", {
    email: "hello@example.com",
    code: requested.body.data.dev_code,
    device_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    device_name: "Test PC",
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.data.session.email, "hello@example.com");

  const session = await post(env, "session", {
    access_token: verified.body.data.session.access_token,
  });
  assert.equal(session.status, 200);
  assert.equal(session.body.data.email, "hello@example.com");
});

test("a new device invalidates the previous device", async () => {
  const env = environment();
  const requested = await post(env, "request-code", { email: "one@example.com" });
  const first = await post(env, "verify", {
    email: "one@example.com",
    code: requested.body.data.dev_code,
    device_id: "11111111-1111-4111-8111-111111111111",
  });
  env.AUTH_KV.clearRateLimits();
  const requestedAgain = await post(env, "request-code", { email: "one@example.com" });
  const second = await post(env, "verify", {
    email: "one@example.com",
    code: requestedAgain.body.data.dev_code,
    device_id: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(second.status, 200);

  const oldSession = await post(env, "session", {
    access_token: first.body.data.session.access_token,
  });
  assert.equal(oldSession.status, 401);
  assert.equal(oldSession.body.error.code, "session_invalid");
});

test("a verification code can only be used once", async () => {
  const env = environment();
  const requested = await post(env, "request-code", { email: "once@example.com" });
  const payload = {
    email: "once@example.com",
    code: requested.body.data.dev_code,
    device_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };
  assert.equal((await post(env, "verify", payload)).status, 200);
  const reused = await post(env, "verify", payload);
  assert.equal(reused.status, 401);
  assert.equal(reused.body.error.code, "invalid_code");
});

test("code requests are rate limited", async () => {
  const env = environment();
  assert.equal((await post(env, "request-code", { email: "rate@example.com" })).status, 200);
  const repeated = await post(env, "request-code", { email: "rate@example.com" });
  assert.equal(repeated.status, 429);
  assert.equal(repeated.body.error.code, "rate_limited");
});

test("production code requests use the Brevo transactional email API", async () => {
  const requests = [];
  const env = {
    ...environment(),
    AUTH_DEV_RETURN_CODE: "0",
    BREVO_API_KEY: "test-api-key",
    BREVO_FROM_EMAIL: "login@mail.jiandan.qd.je",
    BREVO_FROM_NAME: "剪蛋",
    AUTH_FETCH: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ messageId: "message-id" }));
    },
  };

  const result = await post(env, "request-code", { email: "delivery@example.com" });
  assert.equal(result.status, 200);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(requests[0].options.headers["api-key"], "test-api-key");
  const payload = JSON.parse(requests[0].options.body);
  assert.deepEqual(payload.to, [{ email: "delivery@example.com" }]);
  assert.deepEqual(payload.sender, { email: "login@mail.jiandan.qd.je", name: "剪蛋" });
  assert.match(payload.subject, /^\d{6} 是你的剪蛋验证码$/);
  assert.match(payload.textContent, /验证码是 \d{6}/);
});

test("verification attempts are capped", async () => {
  const env = environment();
  const requested = await post(env, "request-code", { email: "attempts@example.com" });
  const wrongCode = requested.body.data.dev_code === "000000" ? "000001" : "000000";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await post(env, "verify", {
      email: "attempts@example.com",
      code: wrongCode,
      device_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    assert.equal(response.status, 401);
  }
  const blocked = await post(env, "verify", {
    email: "attempts@example.com",
    code: wrongCode,
    device_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, "too_many_attempts");
});

test("verified desktop users appear in the admin overview", async () => {
  const env = environment();
  const requested = await post(env, "request-code", { email: "member@example.com" });
  await post(env, "verify", {
    email: "member@example.com",
    code: requested.body.data.dev_code,
    device_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    device_name: "Editing PC",
  });
  env.AUTH_KV.clearRateLimits();
  const adminCode = await post(env, "admin-request-code", { email: "owner@example.com" });
  const admin = await post(env, "admin-verify", {
    email: "owner@example.com",
    code: adminCode.body.data.dev_code,
  });
  const overview = await post(env, "admin-overview", { token: admin.body.data.token });

  assert.equal(overview.status, 200);
  assert.deepEqual(overview.body.data.stats, { total: 1, active: 1, blocked: 0, deleted: 0 });
  assert.equal(overview.body.data.users[0].email, "member@example.com");
  assert.equal(overview.body.data.users[0].device_name, "Editing PC");
  assert.equal("device_id" in overview.body.data.users[0], false);
});

test("non-admin emails cannot enter the admin console", async () => {
  const env = environment();
  const response = await post(env, "admin-request-code", { email: "member@example.com" });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "admin_forbidden");
});

test("blocking a user invalidates the desktop session immediately", async () => {
  const env = environment();
  const requested = await post(env, "request-code", { email: "member@example.com" });
  const desktop = await post(env, "verify", {
    email: "member@example.com",
    code: requested.body.data.dev_code,
    device_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  env.AUTH_KV.clearRateLimits();
  const adminCode = await post(env, "admin-request-code", { email: "owner@example.com" });
  const admin = await post(env, "admin-verify", {
    email: "owner@example.com",
    code: adminCode.body.data.dev_code,
  });
  const update = await post(env, "admin-update-user", {
    token: admin.body.data.token,
    email: "member@example.com",
    status: "blocked",
  });
  const oldSession = await post(env, "session", {
    access_token: desktop.body.data.session.access_token,
  });

  assert.equal(update.status, 200);
  assert.equal(oldSession.status, 401);
  assert.equal(oldSession.body.error.code, "session_invalid");
});
