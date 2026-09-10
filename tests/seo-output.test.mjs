import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {publicRoutes, site} from "../src/siteContent.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist", "client");
const fileFor = (route) => route === "/" ? path.join(output, "index.html") : path.join(output, route.slice(1), "index.html");
const readRoute = (route) => readFile(fileFor(route), "utf8");

test("every public route has readable initial HTML and unique metadata", async () => {
  const titles = new Set();
  for (const route of publicRoutes) {
    const html = await readRoute(route);
    const title = html.match(/<title>(.*?)<\/title>/u)?.[1];
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/u)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)">/u)?.[1];

    assert.ok(title, `${route} is missing a title`);
    assert.ok(!titles.has(title), `${route} reuses title: ${title}`);
    titles.add(title);
    assert.equal(canonical, `${site.origin}${route}`);
    assert.ok(description.length >= 35, `${route} has a thin description`);
    assert.equal((html.match(/<h1[ >]/gu) || []).length, 1, `${route} must contain exactly one initial H1`);
    assert.doesNotMatch(html, /<div id="root"><\/div>/u);

    const jsonLd = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/u)?.[1];
    assert.ok(jsonLd, `${route} is missing JSON-LD`);
    assert.equal(JSON.parse(jsonLd)["@context"], "https://schema.org");
  }
});

test("download pages publish the verified release and checksum", async () => {
  for (const route of ["/download/", "/en/download/"]) {
    const html = await readRoute(route);
    assert.ok(html.includes(site.download));
    assert.ok(html.includes(site.sha256));
    assert.match(html, /65,204,099/u);
  }
});

test("sitemap and robots expose only canonical public pages", async () => {
  const sitemap = await readFile(path.join(output, "sitemap.xml"), "utf8");
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => match[1]);
  assert.deepEqual(locations, publicRoutes.map((route) => `${site.origin}${route}`));
  assert.doesNotMatch(sitemap, /\/admin|\/api\//u);

  const robots = await readFile(path.join(output, "robots.txt"), "utf8");
  assert.match(robots, /^User-agent: \*$/mu);
  assert.match(robots, /^Disallow: \/admin$/mu);
  assert.ok(robots.includes(`Sitemap: ${site.origin}/sitemap.xml`));
});

test("private and missing pages are explicitly noindex", async () => {
  for (const file of [path.join(output, "admin", "index.html"), path.join(output, "404.html")]) {
    const html = await readFile(file, "utf8");
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/u);
  }
});

test("IndexNow verification key is available as a static file", async () => {
  const key = "d02c2753ecbe4471b54d047edadc1085";
  const body = await readFile(path.join(output, `${key}.txt`), "utf8");
  assert.equal(body.trim(), key);
});

test("published copy does not claim unverified platform or license support", async () => {
  const html = await Promise.all(publicRoutes.map(readRoute));
  const all = html.join("\n");
  assert.doesNotMatch(all, /支持 CapCut|CapCut compatible|MIT License|免费商用/u);
  assert.match(all, /(?:不|没有)宣称支持.*CapCut Desktop/u);
  assert.match(all, /does not claim.*CapCut Desktop/iu);
});

test("workflow FAQs are readable, linked, bilingual and explicit about limits", async () => {
  for (const [route, sibling, entry] of [
    ["/docs/faq/", "/en/docs/faq/", "/docs/quick-start/"],
    ["/en/docs/faq/", "/docs/faq/", "/en/docs/quick-start/"],
  ]) {
    const html = await readRoute(route);
    assert.ok(publicRoutes.includes(route));
    assert.ok(html.includes(`href="${site.origin}${sibling}"`));
    assert.ok((await readRoute(entry)).includes(`href="${route}"`));
    assert.ok(html.includes(site.github));
    assert.match(html, /CapCut Desktop/u);
    assert.match(html, /v1\.1\.0/u);
    assert.ok((html.match(/<h2>/gu) || []).length >= 8);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/u)[1])["@graph"];
    assert.equal(graph.find((item) => item["@type"] === "TechArticle").about["@id"], `${site.origin}/#software`);
  }
  assert.match(await readRoute("/docs/faq/"), /实际行为受剪映版本与界面状态影响/u);
  assert.match(await readRoute("/en/docs/faq/"), /does not upscale/u);
});
