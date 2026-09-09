# SEO 技术验证记录

验证日期：2026-09-08

## 构建与自动测试

- `npm run build`：通过；生成 14 个公开静态路由、后台壳、404、robots、sitemap 与 llms.txt。
- `npm run test:seo`：6/6 通过。
- `npm run test:sites`：7/7 通过。
- `node --test tests/*.test.mjs`：22/22 通过，包含 9 项登录/后台、6 项 SEO 与 7 项 Worker 契约测试。
- `npm run build:edgeone`：构建链通过；EdgeOne 上传目录包含公开页面和 Edge Function。
- `git diff --check`：无空白错误。
- 公开静态产物敏感模式扫描：未发现 API key、管理员邮箱、验证码或 session token。

## HTTP 与索引契约

- 公开页：独立初始 HTML、唯一 title/description、一个 H1、自引用 canonical。
- 多语言：中文/英文首页、下载与快速开始互设 hreflang；不完整翻译页不伪造英文版本。
- `robots.txt`：允许公开抓取，排除 `/admin` 和 `/api/`，声明规范 sitemap。
- `sitemap.xml`：14 个规范公开 URL，不含后台、API、查询参数或预览地址。
- 未知页面：Sites Worker 返回真实 404 文档。
- 后台：不进 sitemap，并添加 `noindex,nofollow` 与 `X-Robots-Tag`。
- 下载：v1.1.0 URL、65,204,099 字节与 SHA-256 已由 GitHub API和本地副本交叉核对。

## 浏览器回归

- 桌面 1280 宽：首页 Three.js 正常生成 canvas，H1 与下载入口可见，控制台无 error/warn。
- 手机 390x844：中文下载页无横向溢出，按钮与 hash 信息可读。
- 手机 360x800：英文快速开始无横向溢出，标题、正文与下载入口可读。
- 后台 `/admin`：仍加载原 AdminApp，不出现首页内容，控制台无新增错误。
- 首页 `src/HeroThreeScene.jsx`：本轮无 diff，既有角度、比例与动画参数未修改。

## 性能结构

- 公开内容已在初始 HTML 中，不依赖 JavaScript 或 WebGL 才能读到。
- 主入口按路由动态加载。内容页初始 HTML 不再 modulepreload Three.js。
- Three.js 仅在首页应用实际加载后请求；教程和下载页使用独立内容 chunk。

## 上线前注意

本机没有 `JIANDAN_BUILD_BREVO_API_KEY`、发件人和管理员列表环境变量，因此本地生成的 EdgeOne 目录只用于构建结构验证，不能直接覆盖生产登录配置。正式发布应由已配置这些变量的 EdgeOne 项目从已验证提交构建，发布后再做登录和管理后台冒烟。

## 生产发布复核（2026-09-09）

- GitHub `main` 已发布提交 `864f2d7`；官网源码仓库与生产构建保持同一页面树。
- EdgeOne 生产部署 `dppxzuiuh707` 成功。部署包保留 v1.1.0 已验证登录函数，仅替换静态页面与 SEO 文件，未把邮件密钥或管理员信息提交到 GitHub。
- `https://www.jiandan.qd.je/`、`/download/`、`/docs/quick-start/`、`robots.txt` 和 `sitemap.xml` 均返回 200；未知路径返回真实 404。
- `POST /api/auth/request-code` 使用无效邮箱做无副作用冒烟，返回预期的 400 JSON，证明桌面端依赖的登录路由仍由 EdgeOne Function 接管。
- 线上桌面首屏和 390x844 手机首屏完成视觉复核；首页标题、下载入口、演示画面与下一节均可见。
- IndexNow 已提交 sitemap 中的 14 个规范 URL，接口返回 HTTP 202 Accepted。该状态只表示已接收，不代表已经收录或获得排名。
- 裸域 `https://jiandan.qd.je/` 仍由 GitHub Pages 提供无索引跳转页并导向 `www`；规范页、站点地图与登录 API 均以 `www` 为生产主机。

## 当前搜索基线（上线前）

2026-09-08 对“剪蛋 SKYCHENV”“剪蛋 截图 剪映”“jiandan.qd.je”“截图直接粘贴到剪映 Windows 工具”等查询复核，公开搜索结果没有稳定返回官网；泛需求结果主要被剪映官网和通用截图工具占据。该结果记录为上线前 M0/M3 基线，不宣称任何引擎已收录本轮页面。
