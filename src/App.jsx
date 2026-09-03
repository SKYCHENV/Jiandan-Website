import {useEffect, useRef, useState} from "react";
import {createScope, createTimeline, stagger} from "animejs";
import {
  ArrowDown, ArrowRight, Check, DownloadSimple, GithubLogo, ImageSquare, List, Play,
  Translate, WindowsLogo, X,
} from "@phosphor-icons/react";
import {HeroThreeScene} from "./HeroThreeScene";

const copy = {
  zh: {
    nav: ["产品", "使用方式", "故事"], language: "EN", eyebrow: "简单复制到剪映",
    heroTitle: "看见即素材", lead: "看见的，成为作品。", body: "截图之后，灵感自然进入剪映。",
    download: "下载 Windows 版", github: "查看 GitHub", scroll: "继续了解",
    flowKicker: "从看见，到作品", flowTitle: "三步，把看见的变成可编辑的素材",
    flowBody: "不用先发到聊天窗口，不用命名文件，也不用在文件夹里来回寻找。",
    steps: [["01", "截下", "在任何地方捕捉你想留下的画面。"], ["02", "复制", "图片进入剪贴板，剪蛋实时识别。"], ["03", "继续", "回到剪映，素材已经准备好。"]],
    proofKicker: "真实工作流", proofTitle: "灵感不必离开创作。",
    proofBody: "剪蛋安静地待在后台，只在图片出现时接住它。你的键盘、文字剪贴板和剪映操作依然属于你。",
    status: "图片已准备进入作品", enabled: "已开启", filmKicker: "剪蛋的故事",
    filmTitle: "让每一次看见，\n更快进入作品。", play: "播放宣传片", finalTitle: "现在，让截图成为素材。",
    finalBody: "适用于 Windows 与剪映专业版。开源、轻量，双击 Jiandan.exe 即可开始。",
    finalCta: "前往 GitHub 下载", source: "查看源代码", footer: "为每一个不想打断灵感的人而做。",
  },
  en: {
    nav: ["Product", "How it works", "Story"], language: "中", eyebrow: "Copy images into Jianying, simply",
    heroTitle: "See it. Use it", lead: "What you see becomes the work.", body: "Capture it. Keep creating in Jianying.",
    download: "Download for Windows", github: "View on GitHub", scroll: "Discover more",
    flowKicker: "From sight to story", flowTitle: "Three steps from sight to editable material.",
    flowBody: "No chat window, no file naming, and no searching through folders before you can edit.",
    steps: [["01", "Capture", "Keep any moment you notice on screen."], ["02", "Copy", "Jiandan recognizes the image on your clipboard."], ["03", "Continue", "Return to Jianying. Your material is ready."]],
    proofKicker: "A real workflow", proofTitle: "Inspiration stays in motion.",
    proofBody: "Jiandan waits quietly in the background and responds only to images. Your keyboard, text clipboard, and editing workflow remain yours.",
    status: "Image ready for your project", enabled: "On", filmKicker: "The Jiandan story",
    filmTitle: "Let every moment you notice\nreach the work sooner.", play: "Play the film", finalTitle: "Make screenshots into material.",
    finalBody: "Built for Windows and Jianying Pro. Open source, lightweight, and ready from Jiandan.exe.",
    finalCta: "Download on GitHub", source: "View source", footer: "Made for anyone who does not want to interrupt an idea.",
  },
};

const githubUrl = "https://github.com/SKYCHENV/Jiandan";
const publicPath = (path) => `${import.meta.env.BASE_URL}${path}`;
const downloadUrl = "https://github.com/SKYCHENV/Jiandan/releases/download/v1.0.0/Jiandan.exe";

function Brand({compact = false}) {
  return <a className={`brand ${compact ? "brand--compact" : ""}`} href="#top" aria-label="剪蛋首页"><img src={publicPath("assets/jiandan.png")} alt="" /><span>剪蛋</span></a>;
}

function AppHeader({language, setLanguage, menuOpen, setMenuOpen, t}) {
  const links = ["#product", "#how", "#story"];
  const close = () => setMenuOpen(false);
  return <header className="site-header">
    <Brand compact />
    <nav className={menuOpen ? "nav nav--open" : "nav"} aria-label="主要导航">
      {t.nav.map((label, index) => <a key={label} href={links[index]} onClick={close}>{label}</a>)}
      <a href={githubUrl} target="_blank" rel="noreferrer">GitHub <ArrowRight weight="bold" /></a>
      <button className="language" onClick={() => {setLanguage(language === "zh" ? "en" : "zh"); close();}} aria-label="切换语言"><Translate weight="bold" /> {t.language}</button>
    </nav>
    <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "关闭菜单" : "打开菜单"}>{menuOpen ? <X /> : <List />}</button>
  </header>;
}

function Hero({t}) {
  const heroRef = useRef(null);
  const scopeRef = useRef(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      heroRef.current?.classList.add("hero--ready");
      return undefined;
    }

    scopeRef.current = createScope({root: heroRef}).add(() => {
      const intro = createTimeline({defaults: {ease: "out(4)"}});
      intro
        .add(".hero-copy h1", {opacity: [0, 1], duration: 80}, 80)
        .add(".hero-headline > span, .hero-headline > i", {opacity: [0, 1], y: [42, 0], rotateX: [-70, 0], duration: 820, delay: stagger(58)}, 90)
        .add(".hero-copy > p, .hero-actions", {opacity: [0, 1], y: [26, 0], duration: 760, delay: stagger(90)}, 380)
        .add(".three-scene", {opacity: [0, 1], duration: 900}, 0);
    });

    return () => scopeRef.current?.revert();
  }, []);

  return <section className="hero" id="product" ref={heroRef}>
    <div className="hero-copy"><h1 aria-label={`剪蛋，${t.heroTitle}`}><span className="hero-headline" aria-hidden="true">{Array.from(t.heroTitle).map((character, index) => <span key={`${character}-${index}`}>{character === " " ? "\u00a0" : character}</span>)}<i>。</i></span></h1><p className="hero-lead">{t.lead}</p><p className="hero-body">{t.body}</p>
      <div className="hero-actions"><a className="button button--primary" href={downloadUrl} download><WindowsLogo weight="fill" />{t.download}</a></div>
    </div>
    <HeroThreeScene />
    <a className="scroll-cue" href="#how"><span>{t.scroll}</span><ArrowDown /></a>
  </section>;
}

function HowItWorks({t}) {
  return <section className="flow section-light" id="how"><div className="section-intro reveal is-visible"><p className="eyebrow eyebrow--blue">{t.flowKicker}</p><h2>{t.flowTitle.split("\n").map((line) => <span key={line}>{line}</span>)}</h2><p>{t.flowBody}</p></div>
    <div className="steps">{t.steps.map(([number, title, body], index) => <article className="step reveal" style={{"--delay": `${index * 100}ms`}} key={number}><span className="step-number">{number}</span><div className="step-icon">{index === 0 ? <ImageSquare weight="regular" /> : index === 1 ? <DownloadSimple weight="regular" /> : <Check weight="bold" />}</div><h3>{title}</h3><p>{body}</p></article>)}</div>
  </section>;
}

function ProductProof({t}) {
  return <section className="proof section-light"><div className="proof-copy reveal"><p className="eyebrow eyebrow--blue">{t.proofKicker}</p><h2>{t.proofTitle}</h2><p>{t.proofBody}</p><div className="status-line"><span /><strong>{t.status}</strong><small>{t.enabled}</small></div></div>
    <div className="demo-window reveal"><div className="window-bar"><i /><i /><i /><span>剪蛋 × 剪映</span></div><video src={publicPath("assets/jiandan-demo.mp4")} muted loop playsInline autoPlay poster={publicPath("assets/product-demo-frame.webp")} aria-label="剪蛋真实工作演示" /></div>
  </section>;
}

function Film({t}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const toggle = async () => {if (!videoRef.current) return; if (videoRef.current.paused) {await videoRef.current.play(); setPlaying(true);} else {videoRef.current.pause(); setPlaying(false);}};
  return <section className="film" id="story"><div className="film-heading reveal"><p className="eyebrow">{t.filmKicker}</p><h2>{t.filmTitle.split("\n").map((line) => <span key={line}>{line}</span>)}</h2></div>
    <div className="film-player reveal"><video ref={videoRef} src={publicPath("assets/jiandan-film.mp4")} playsInline controls={playing} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />{!playing && <button className="play-button" onClick={toggle}><Play weight="fill" /><span>{t.play}</span></button>}</div>
  </section>;
}

function Download({t}) {
  return <section className="download-section"><img src={publicPath("assets/jiandan.png")} alt="剪蛋" className="download-logo reveal" /><div className="reveal"><h2>{t.finalTitle}</h2><p>{t.finalBody}</p></div><div className="download-actions reveal"><a className="button button--primary" href={downloadUrl} download><WindowsLogo weight="fill" />{t.finalCta}</a><a className="text-link" href={githubUrl} target="_blank" rel="noreferrer">{t.source}<ArrowRight weight="bold" /></a></div></section>;
}

export function App() {
  const [language, setLanguage] = useState("zh");
  const [menuOpen, setMenuOpen] = useState(false);
  const t = copy[language];
  useEffect(() => {document.documentElement.lang = language === "zh" ? "zh-CN" : "en";}, [language]);
  useEffect(() => {const elements = document.querySelectorAll(".reveal"); const observer = new IntersectionObserver((entries) => {entries.forEach((entry) => {if (entry.isIntersecting) {entry.target.classList.add("is-visible"); observer.unobserve(entry.target);}});}, {threshold: 0.12}); elements.forEach((element) => observer.observe(element)); return () => observer.disconnect();}, [language]);
  return <div id="top"><AppHeader language={language} setLanguage={setLanguage} menuOpen={menuOpen} setMenuOpen={setMenuOpen} t={t} /><main><Hero t={t} /><HowItWorks t={t} /><ProductProof t={t} /><Film t={t} /><Download t={t} /></main><footer><Brand compact /><p>{t.footer}</p><a href={githubUrl} target="_blank" rel="noreferrer"><GithubLogo weight="fill" />GitHub</a></footer></div>;
}
