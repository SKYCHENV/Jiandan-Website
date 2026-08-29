# 剪蛋官网 / Jiandan Website

剪蛋是一个面向 Windows 与剪映专业版的开源小工具。它识别剪贴板中的图片，让截图自然进入剪映素材工作流，不必先保存到聊天窗口或手动整理文件。

This repository contains the official bilingual website for Jiandan, an open-source Windows utility that turns clipboard images into ready-to-use Jianying Pro material.

## 技术栈 / Stack

- React 19 + Vite
- Three.js for the interactive hero scene
- Anime.js for interface motion
- Node test runner for deployment-worker tests
- OpenAI Sites-compatible worker output

## 本地开发 / Local development

```bash
npm install
npm run dev
```

生产构建与验证：

```bash
npm run build
npm run test:sites
```

The production site is generated in `dist/`. The build also prepares the Sites worker and hosting metadata used for deployment.

## 项目链接 / Project

- 剪蛋主项目 / Main app: https://github.com/SKYCHENV/Jiandan
- Windows 下载 / Download: served from `public/downloads/Jiandan-Windows.zip`

## License

MIT
