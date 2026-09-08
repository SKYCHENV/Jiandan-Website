#!/usr/bin/env node
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {pages, publicRoutes, site} from "../src/siteContent.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist", "client");
const template = await readFile(path.join(output, "index.html"), "utf8");

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const absolute = (pathname) => pathname.startsWith("http") ? pathname : `${site.origin}${pathname}`;

function renderSection(section) {
  const paragraphs = (section.paragraphs || []).map((value) => `<p>${escapeHtml(value)}</p>`).join("");
  const steps = section.steps ? `<ol class="content-steps">${section.steps.map(([number, title, body]) => `<li><span>${escapeHtml(number)}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div></li>`).join("")}</ol>` : "";
  const notes = section.notes ? `<ul class="content-notes">${section.notes.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : "";
  const facts = section.facts ? `<dl class="content-facts">${section.facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd${label === "SHA-256" ? ' class="hash"' : ""}>${escapeHtml(value)}</dd></div>`).join("")}</dl>` : "";
  const table = section.table ? `<div class="content-table-wrap"><table><thead><tr>${section.table.headers.map((value) => `<th>${escapeHtml(value)}</th>`).join("")}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
  const code = section.code ? `<pre><code>${escapeHtml(section.code)}</code></pre>` : "";
  return `<section class="content-section"><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${steps}${notes}${facts}${table}${code}</section>`;
}

function brand(english = false) {
  return `<a class="brand brand--compact" href="${english ? "/en/" : "/"}" aria-label="${english ? "Jiandan home" : "剪蛋首页"}"><img src="/assets/jiandan.png" alt=""><span>${english ? "Jiandan" : "剪蛋"}</span></a>`;
}

function renderHeader(english = false) {
  const links = english
    ? [["Product", "/en/"], ["Quick start", "/en/docs/quick-start/"], ["Download", "/en/download/"]]
    : [["产品", "/"], ["快速开始", "/docs/quick-start/"], ["下载", "/download/"], ["关于", "/about/"]];
  return `<header class="site-header content-header">${brand(english)}<nav class="nav" aria-label="${english ? "Primary navigation" : "主要导航"}">${links.map(([label, href]) => `<a href="${href}">${label}</a>`).join("")}<a href="${site.github}">GitHub</a><a class="language" href="${english ? "/" : "/en/"}">${english ? "中" : "EN"}</a></nav></header>`;
}

function renderPage(page) {
  const english = page.locale === "en";
  const actions = page.cta || page.secondary ? `<div class="content-actions">${page.cta ? `<a class="button button--primary" href="${page.ctaHref}">${escapeHtml(page.cta)}</a>` : ""}${page.secondary ? `<a class="button button--quiet" href="${page.secondaryHref}">${escapeHtml(page.secondary)}</a>` : ""}</div>` : "";
  const related = page.related ? `<aside class="content-related"><h2>${english ? "Continue" : "继续了解"}</h2><div>${page.related.map(([label, href]) => `<a href="${href}">${escapeHtml(label)} →</a>`).join("")}</div></aside>` : "";
  return `<div class="content-page">${renderHeader(english)}<main><header class="content-hero"><p class="eyebrow eyebrow--blue">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1><p class="content-summary">${escapeHtml(page.summary)}</p>${actions}<p class="content-meta">${english ? "Verified" : "核对日期"} · ${page.updated}</p></header><div class="content-body">${page.sections.map(renderSection).join("")}</div>${related}</main><footer class="content-footer">${brand(english)}<p>${english ? "Screenshots into Jianying, with fewer steps." : "让截图少绕一圈，进入剪映。"}</p><a href="${site.github}">GitHub</a></footer></div>`;
}

function renderHome() {
  return `<div id="top"><header class="site-header">${brand(false)}<nav class="nav" aria-label="主要导航"><a href="#product">产品</a><a href="#how">使用方式</a><a href="#story">故事</a><a href="${site.github}">GitHub</a><a class="language" href="/en/">EN</a></nav></header><main><section class="hero hero--ready" id="product"><div class="hero-copy"><h1><span class="hero-headline">看见即素材<i>。</i></span></h1><p class="hero-lead">看见的，成为作品。</p><p class="hero-body">剪蛋是一款 Windows 工具，把截图或剪贴板图片直接粘贴到剪映专业版。</p><div class="hero-actions"><a class="button button--primary" href="/download/">下载 Windows 版</a></div></div></section><section class="flow section-light" id="how"><div class="section-intro reveal is-visible"><p class="eyebrow eyebrow--blue">从看见，到作品</p><h2>三步，把看见的变成可编辑的素材</h2><p>截图或复制图片，回到剪映素材页按 Ctrl+V，继续编辑。</p></div></section><section class="download-section" id="story"><h2>现在，让截图成为素材。</h2><p>适用于 Windows 10/11 与剪映专业版。首次使用需要邮箱验证码登录，图片和剪贴板内容不会上传。</p><div class="download-actions"><a class="button button--primary" href="/download/">官方下载</a><a class="text-link" href="/docs/quick-start/">快速开始 →</a></div></section></main><footer>${brand(false)}<div class="footer-center"><p>为每一个不想打断灵感的人而做。</p><nav><a href="/download/">下载</a><a href="/docs/quick-start/">快速开始</a><a href="/docs/compatibility/">兼容性</a></nav></div><a href="${site.github}">GitHub</a></footer></div>`;
}

function alternates(route) {
  const pairs = {
    "/": "/en/", "/en/": "/", "/download/": "/en/download/", "/en/download/": "/download/",
    "/docs/quick-start/": "/en/docs/quick-start/", "/en/docs/quick-start/": "/docs/quick-start/",
  };
  const counterpart = pairs[route];
  if (!counterpart) return `<link rel="alternate" hreflang="zh-CN" href="${absolute(route)}">`;
  const zh = route.startsWith("/en/") ? counterpart : route;
  const en = route.startsWith("/en/") ? route : counterpart;
  return `<link rel="alternate" hreflang="zh-CN" href="${absolute(zh)}"><link rel="alternate" hreflang="en" href="${absolute(en)}"><link rel="alternate" hreflang="x-default" href="${absolute(zh)}">`;
}

function schema(route, page) {
  const english = page?.locale === "en";
  const graph = [{
    "@type": "Organization", "@id": `${site.origin}/#organization`, name: "Jiandan", alternateName: "剪蛋", url: site.origin, sameAs: [site.github],
  }];
  if (["/", "/en/", "/download/", "/en/download/"].includes(route)) {
    graph.push({"@type": "SoftwareApplication", "@id": `${site.origin}/#software`, name: english ? "Jiandan" : "剪蛋 Jiandan", applicationCategory: "MultimediaApplication", operatingSystem: "Windows 10, Windows 11", softwareVersion: site.version, downloadUrl: site.download, url: absolute(route), description: page?.description || "把截图或剪贴板图片直接粘贴到剪映专业版的 Windows 工具。", publisher: {"@id": `${site.origin}/#organization`}});
  } else if (page) {
    graph.push({"@type": "TechArticle", headline: page.title, description: page.description, dateModified: page.updated, inLanguage: page.locale, mainEntityOfPage: absolute(route), author: {"@id": `${site.origin}/#organization`}, publisher: {"@id": `${site.origin}/#organization`}});
  }
  if (route !== "/") graph.push({"@type": "BreadcrumbList", itemListElement: [{"@type": "ListItem", position: 1, name: english ? "Jiandan" : "剪蛋", item: absolute(english ? "/en/" : "/")}, {"@type": "ListItem", position: 2, name: page.title, item: absolute(route)}]});
  return JSON.stringify({"@context": "https://schema.org", "@graph": graph}).replaceAll("<", "\\u003c");
}

function metadata(route, page, {noindex = false} = {}) {
  const title = route === "/" ? "剪蛋 Jiandan - 截图直接粘贴到剪映的 Windows 工具" : page.title;
  const description = route === "/" ? "剪蛋是一款 Windows 工具，让系统截图或剪贴板图片直接进入剪映专业版素材区和播放头位置，省去保存文件再导入。" : page.description;
  const canonical = absolute(route);
  return `<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">${noindex ? '<meta name="robots" content="noindex,nofollow">' : ""}<link rel="canonical" href="${canonical}">${alternates(route)}<meta property="og:type" content="website"><meta property="og:site_name" content="剪蛋 Jiandan"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${site.origin}/assets/product-demo-frame.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${site.origin}/assets/product-demo-frame.png"><script type="application/ld+json">${schema(route, page)}</script>`;
}

function applyTemplate(route, body, page, options) {
  const language = page?.locale === "en" ? "en" : "zh-CN";
  return template
    .replace('<html lang="zh-CN">', `<html lang="${language}">`)
    .replace(/\s*<meta name="description"[^>]*>/u, "")
    .replace(/\s*<title>.*?<\/title>/u, "")
    .replace("</head>", `    ${metadata(route, page, options)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

for (const route of publicRoutes) {
  const page = pages[route];
  const html = applyTemplate(route, route === "/" ? renderHome() : renderPage(page), page);
  const directory = route === "/" ? output : path.join(output, route.slice(1));
  await mkdir(directory, {recursive: true});
  await writeFile(path.join(directory, "index.html"), html);
}

const adminHtml = template
  .replace(/\s*<meta name="description"[^>]*>/u, "")
  .replace(/\s*<title>.*?<\/title>/u, "")
  .replace("</head>", '    <title>剪蛋管理后台</title><meta name="robots" content="noindex,nofollow">\n  </head>');
await mkdir(path.join(output, "admin"), {recursive: true});
await writeFile(path.join(output, "admin", "index.html"), adminHtml);

const notFound = applyTemplate("/404/", '<main class="not-found"><p class="eyebrow eyebrow--blue">404</p><h1>这里没有这张素材。</h1><p>地址可能已变更，请回到剪蛋首页。</p><p><a class="button button--primary" href="/">返回首页</a></p></main>', {title: "页面未找到", description: "该页面不存在。", locale: "zh-CN", sections: [], updated: "2026-09-08"}, {noindex: true});
await writeFile(path.join(output, "404.html"), notFound);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicRoutes.map((route) => `  <url><loc>${absolute(route)}</loc><lastmod>${pages[route]?.updated || "2026-09-08"}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(output, "sitemap.xml"), sitemap);
await writeFile(path.join(output, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${site.origin}/sitemap.xml\n`);
await writeFile(path.join(output, "llms.txt"), `# 剪蛋 Jiandan\n\n剪蛋是一款 Windows 工具，用于把系统截图或剪贴板图片直接粘贴到剪映专业版。它减少先保存图片、寻找文件再导入的步骤。\n\n- 官网：${site.origin}/\n- 下载与校验：${site.origin}/download/\n- 快速开始：${site.origin}/docs/quick-start/\n- 兼容性与限制：${site.origin}/docs/compatibility/\n- 官方源代码与发布：${site.github}\n\n当前正式版：v${site.version}（${site.published}）。支持 Windows 10/11 和剪映专业版；不宣称支持 CapCut Desktop、macOS 或移动端。首次使用需要邮箱验证码登录。图片和剪贴板内容不会上传。\n`);

console.log(`Prerendered ${publicRoutes.length} public routes plus admin and 404 documents.`);
