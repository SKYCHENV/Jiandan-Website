import {ArrowRight, DownloadSimple, GithubLogo, List, Translate, X} from "@phosphor-icons/react";
import {useEffect, useState} from "react";
import {normalizePath, pages, site} from "./siteContent";

const publicPath = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//u, "")}`;

function SiteBrand({english = false}) {
  return <a className="brand brand--compact" href={english ? "/en/" : "/"} aria-label={english ? "Jiandan home" : "剪蛋首页"}>
    <img src={publicPath("assets/jiandan.png")} alt="" />
    <span>{english ? "Jiandan" : "剪蛋"}</span>
  </a>;
}

function ContentHeader({english = false}) {
  const [open, setOpen] = useState(false);
  const links = english
    ? [["Product", "/en/"], ["Quick start", "/en/docs/quick-start/"], ["Download", "/en/download/"]]
    : [["产品", "/"], ["快速开始", "/docs/quick-start/"], ["下载", "/download/"], ["关于", "/about/"]];
  return <header className="site-header content-header">
    <SiteBrand english={english} />
    <nav className={open ? "nav nav--open" : "nav"} aria-label={english ? "Primary navigation" : "主要导航"}>
      {links.map(([label, href]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}
      <a href={site.github} target="_blank" rel="noreferrer">GitHub <ArrowRight weight="bold" /></a>
      <a className="language" href={english ? "/" : "/en/"}><Translate weight="bold" />{english ? "中" : "EN"}</a>
    </nav>
    <button className="menu-button" onClick={() => setOpen(!open)} aria-label={open ? "关闭菜单" : "打开菜单"}>{open ? <X /> : <List />}</button>
  </header>;
}

function Actions({page}) {
  if (!page.cta && !page.secondary) return null;
  return <div className="content-actions">
    {page.cta && <a className="button button--primary" href={page.ctaHref}>{page.ctaHref === site.download && <DownloadSimple weight="bold" />}{page.cta}<ArrowRight weight="bold" /></a>}
    {page.secondary && <a className="button button--quiet" href={page.secondaryHref}>{page.secondary}</a>}
  </div>;
}

function Section({section}) {
  return <section className="content-section">
    <h2>{section.heading}</h2>
    {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    {section.steps && <ol className="content-steps">{section.steps.map(([number, title, body]) => <li key={`${number}-${title}`}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>}
    {section.notes && <ul className="content-notes">{section.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
    {section.facts && <dl className="content-facts">{section.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={label === "SHA-256" ? "hash" : ""}>{value}</dd></div>)}</dl>}
    {section.table && <div className="content-table-wrap"><table><thead><tr>{section.table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{section.table.rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>}
    {section.code && <pre><code>{section.code}</code></pre>}
  </section>;
}

function Related({items, english}) {
  return <aside className="content-related" aria-label={english ? "Related pages" : "继续了解"}>
    <h2>{english ? "Continue" : "继续了解"}</h2>
    <div>{items.map(([label, href]) => <a key={href} href={href}>{label}<ArrowRight weight="bold" /></a>)}</div>
  </aside>;
}

export function ContentPage({path}) {
  const page = pages[path];
  if (!page) return <NotFound />;
  const english = page.locale === "en";
  useEffect(() => {
    document.documentElement.lang = english ? "en" : "zh-CN";
    document.title = `${page.title} | ${english ? "Jiandan" : "剪蛋"}`;
  }, [english, page.title]);
  return <div className="content-page">
    <ContentHeader english={english} />
    <main>
      <header className="content-hero">
        <p className="eyebrow eyebrow--blue">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p className="content-summary">{page.summary}</p>
        <Actions page={page} />
        <p className="content-meta">{english ? "Verified" : "核对日期"} · {page.updated}</p>
      </header>
      <div className="content-body">{page.sections.map((section) => <Section key={section.heading} section={section} />)}</div>
      {page.related && <Related items={page.related} english={english} />}
    </main>
    <footer className="content-footer"><SiteBrand english={english} /><p>{english ? "Screenshots into Jianying, with fewer steps." : "让截图少绕一圈，进入剪映。"}</p><a href={site.github} target="_blank" rel="noreferrer"><GithubLogo weight="fill" />GitHub</a></footer>
  </div>;
}

export function NotFound() {
  return <div className="content-page"><ContentHeader /><main className="not-found"><p className="eyebrow eyebrow--blue">404</p><h1>这里没有这张素材。</h1><p>地址可能已变更，回到剪蛋首页或查看快速开始。</p><div className="content-actions"><a className="button button--primary" href="/">返回首页</a><a className="button button--quiet" href="/docs/quick-start/">快速开始</a></div></main></div>;
}

export function resolvePublicApp(pathname) {
  const path = normalizePath(pathname);
  return pages[path] ? <ContentPage path={path} /> : <NotFound />;
}
