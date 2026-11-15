# Argon Astro

Argon WordPress 主题的 Astro 移植版。沿用 Argon 1.3.5 的 CSS、图标和页面结构，包含双栏博客、文章目录、说说、归档、搜索、主题切换及阅读进度。

## 本地运行

需要 Node.js 22.23.4 或更新版本。

```bash
npm ci
npm run dev
```

默认开发地址是 `http://localhost:4321/`。生产构建用 `npm run build`，用 `npm start` 启动 Node 服务。支持 `HOST` 和 `PORT` 环境变量。动态搜索和可选的访问控制需要 Node 服务。

## 配置站点

- 在 `src/data/site.json` 设置站点域名、标题、语言、主题色、Banner、背景、分类和菜单。
- 在 `src/content/posts/` 添加 Markdown 文章或页面。已有示例演示了 `title`、`date` 和 `path` 的写法。每篇文章的 `path` 应唯一。
- `src/data/posts.json` 可保存已渲染的 HTML 条目，包括首页混排的说说。
- `src/data/comments.json` 支持展示已导入的历史评论。新留言和修改在 `/auth/comments/` 审核，留言、点赞和置顶保存在 `ARGON_STATE_DIR`。访客可用发送留言时的浏览器编辑留言和查看自己的悄悄话。

可选的站主登录位于 `/auth/`。用 `npm run admin:setup` 设置站主密码。若使用受限内容，另准备仓库外的运行目录并以 `npm run admin:setup -- --private-dir <路径>` 配置。受限目录中的 `entries.json` 使用 `{ "posts": [], "comments": [] }` 结构，文件放在 `uploads/`。条目的 `visibility` 可为 `private` 或 `password`，服务端会校验条目及其授权媒体。用于生产时，通过 HTTPS 访问。

站主登录后访问 `/auth/argon/` 可以修改主题设置并导入或导出 JSON。后台修改默认保存在 Git 忽略的 `.argon-state/`，部署时可以用 `ARGON_STATE_DIR` 指定持久目录。

要发送回复通知，先在服务端配置 `ARGON_SMTP_URL` 和 `ARGON_MAIL_FROM`，再在 Argon 设置开启邮件通知。访客收到确认邮件并确认后才会接收回复通知。

## 许可

移植代码遵循 GPL-3.0，原主题与上游资源见 [solstice23/argon-theme](https://github.com/solstice23/argon-theme)。平滑滚动使用 Balazs Galambosi 的 [SmoothScroll](https://www.smoothscroll.net/)。页脚保留 Argon 名称和链接。
