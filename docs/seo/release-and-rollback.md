# SEO 发布与回滚记录

## 冻结基线

- 官网仓库：`SKYCHENV/Jiandan-Website`
- 基线分支：`main`
- 基线提交：`be15a2c`
- 正式主域：`https://www.jiandan.qd.je/`
- 裸域：`https://jiandan.qd.je/`，当前以 noindex HTML 跳转到 www
- 正式程序：`SKYCHENV/Jiandan` v1.1.0
- 首页 Three.js 文件：`src/HeroThreeScene.jsx`，本轮禁止修改

## 本轮保留项

- 不修改剪蛋桌面程序、登录后端、安装包或 Release。
- 不修改首页 Three.js 场景、角度、比例、轨道、箭头或动画时序。
- 不公开管理员邮箱、验证码、API 密钥、会话或后台数据。
- `/admin` 与 `/api` 不进入 sitemap；后台文档与响应标记 noindex。

## 回滚方法

1. 记录本轮发布提交与 EdgeOne/Sites 部署 ID。
2. 如上线后首页、下载、登录或后台出现回归，将生产部署切回基线提交 `be15a2c` 对应版本。
3. 回滚只针对官网仓库；不得重置或覆盖主程序仓库及用户的其它未提交文件。
4. 回滚后复测首页、`/admin`、登录 API、v1.1.0 下载链接和裸域跳转。

## 上线前阻断条件

- EdgeOne 构建环境缺少登录邮件与管理员配置时，不得用本地空变量产物覆盖生产。
- SEO、Sites 和 Worker 测试未全部通过时不得发布。
- 正式域下载 hash 与 GitHub Release 不一致时立即停止发布。
