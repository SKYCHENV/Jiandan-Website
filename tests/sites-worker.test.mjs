import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("serves a prerendered public route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/docs/quick-start/?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/docs/quick-start/index.html" ? "guide" : "missing", {
            status: url.pathname === "/docs/quick-start/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/docs/quick-start/?source=share", "/docs/quick-start/index.html"]);
});

test("redirects canonical public routes to a trailing slash", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/download?source=share", {headers: {accept: "text/html"}}),
    {ASSETS: {fetch: async () => new Response("missing", {status: 404})}},
  );

  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://example.test/download/?source=share");
});

test("returns a real 404 document for an unknown route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/unknown", {headers: {accept: "text/html"}}),
    {ASSETS: {fetch: async (request) => {
      const pathname = new URL(request.url).pathname;
      calls.push(pathname);
      return new Response(pathname === "/404.html" ? "not found" : "missing", {status: pathname === "/404.html" ? 200 : 404});
    }}},
  );

  assert.equal(response.status, 404);
  assert.deepEqual(calls, ["/flow/unknown", "/404.html"]);
});

test("serves admin shell with noindex header", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/admin", {headers: {accept: "text/html"}}),
    {ASSETS: {fetch: async (request) => new Response(new URL(request.url).pathname === "/admin/index.html" ? "admin" : "missing", {status: new URL(request.url).pathname === "/admin/index.html" ? 200 : 404})}},
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/client/download/index.html", import.meta.url));
  await access(new URL("../dist/client/sitemap.xml", import.meta.url));
  await access(new URL("../dist/client/robots.txt", import.meta.url));
  await access(new URL("../dist/client/404.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
