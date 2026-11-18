# Argon Astro

Argon Astro 是面向个人博客的 Astro 主题，沿用 [Argon](https://github.com/solstice23/argon-theme) 的视觉设计。项目以 Markdown 编写内容，以 Node.js 服务提供搜索、留言和站主管理。

## 特性

- 响应式布局、三级导航、日间与夜间模式，以及可配置的配色、字体和 Banner。
- 分级文章目录、阅读进度、代码高亮、数学公式和图片灯箱。
- 文章、独立页面、说说、归档和友链，以及站内搜索、RSS 和站点地图。
- 可审核的评论和留言，支持回复、Markdown、表情、编辑、置顶及可选的邮件通知。

## 快速开始

需要 Node.js 22.23.4 或更新版本。

```bash
git clone https://github.com/Chino-233/argon-astro-theme.git
cd argon-astro-theme
npm ci
npm run dev
```

浏览器访问 [http://localhost:4321/](http://localhost:4321/)。

## 集成到 Astro 项目

主题通过 Astro Integration 提供公开路由、渲染组件、样式和互动接口。内容、站点配置和持久化目录由宿主项目管理。在主题仓库中运行 `npm pack` 生成安装包，然后在宿主项目中运行 `npm install /path/to/argon-astro-theme-1.1.0.tgz`。

在 `astro.config.mjs` 中启用主题和 Node.js 适配器。

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import argonTheme from 'argon-astro-theme';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [argonTheme()],
  trailingSlash: 'ignore',
  markdown: { syntaxHighlight: false },
});
```

在 `src/content.config.ts` 中注册 Markdown 内容集合。

```ts
import { argonPosts } from 'argon-astro-theme/collections';

export const collections = { posts: argonPosts() };
```

将示例 [`site.json`](src/data/site.json)、[`posts.json`](src/data/posts.json) 和 [`comments.json`](src/data/comments.json) 复制到宿主的 `src/data/`，并按需替换数据。仅使用 Markdown 时，`posts.json` 和 `comments.json` 可初始化为 `[]`。可以用 `argonTheme({ dataDir: './其他目录' })` 指定配置文件所在目录。

## 配置站点

| 文件或目录 | 用途 |
| --- | --- |
| [`src/data/site.json`](src/data/site.json) | 站点域名、标题、语言、时区、主题默认值、菜单和友链 |
| [`src/content/posts/`](src/content/posts/) | Markdown 文章、页面和说说 |
| [`src/data/posts.json`](src/data/posts.json) | 已渲染的 HTML 条目 |
| [`public/`](public/) | 可公开访问的图片及其他静态文件 |
| [`.env.example`](.env.example) | 运行环境变量 |

发布前将 `src/data/site.json` 的 `site.url` 设为站点的正式地址。导航使用 `id` 和 `parent` 表示层级，`parent: 0` 表示顶层，`url: "#"` 表示分组。友链配置在 `bookmarks` 中。

### 发布内容

在 `src/content/posts/` 新建 Markdown 文件。每篇内容需要标题、日期和唯一的 URL 路径。

```markdown
---
title: 第一篇文章
date: 2026-01-01
path: /posts/hello/
---

从这里开始写正文。
```

`type` 默认为 `post`，也可设为 `page` 或 `shuoshuo`。友链页使用 `type: page` 和 `template: friendlinks`，布局由 `linkStyle` 选择。可用值为 `cards`、`square`、`compact` 和 `large`。

### 管理后台

示例站点附带可选的通用站主管理。设置 `ARGON_ENABLE_ADMIN=false` 后启动开发服务或重新构建，可以只运行博客前端与公开互动。宿主项目可从 `argon-astro-theme/admin` 导入 `argonAdmin`，并在 Astro 的 `integrations` 中添加 `argonAdmin()`。

在交互式终端中运行 `npm run admin:setup`，按提示设置站主密码。命令会创建包含密码哈希和会话密钥的 `.env`。启动或重启服务后，访问 `/auth/` 登录。

| 路径 | 用途 |
| --- | --- |
| `/auth/argon/` | 编辑主题设置，导入或导出配置 |
| `/auth/comments/` | 审核新留言和留言修改 |

需要私密内容时，用 `npm run admin:setup -- --private-dir <目录>` 初始化，或在服务环境中设置 `ARGON_PRIVATE_CONTENT_DIR`。该目录放在仓库外，包含 `entries.json` 和受保护的 `uploads/`。`entries.json` 采用 `{ "posts": [], "comments": [] }` 结构，条目的 `visibility` 可设为 `private` 或 `password`。

## 自托管

```bash
npm run build
npm start
```

将 Node.js 服务置于 HTTPS 反向代理后。使用 `HOST` 和 `PORT` 设置监听地址与端口。部署时为以下目录提供持久存储，并单独保管服务器环境配置。

| 环境变量 | 用途 |
| --- | --- |
| `ARGON_STATE_DIR` | 主题设置、留言和互动数据，默认为 `.argon-state/` |
| `ARGON_COUNTER=true` | 启用站点访问统计与文章浏览量，数据写入状态目录 |
| `ARGON_PRIVATE_CONTENT_DIR` | 可选的私密内容与受保护媒体目录 |
| `ARGON_SMTP_URL`、`ARGON_MAIL_FROM` | 可选的 SMTP 连接地址和发件地址 |

配置 SMTP 后，在 Argon 设置中开启邮件回复通知。订阅者确认订阅后才会收到回复邮件。

## 参与贡献

提交问题时请附上 Node.js 版本、复现步骤和预期结果。提交拉取请求前，运行 `npm run build` 验证构建。

## 许可

本项目依据 [GPL-3.0](LICENSE) 发布。原主题由 [solstice23](https://github.com/solstice23/argon-theme) 开发，平滑滚动使用 Balazs Galambosi 的 [SmoothScroll](https://www.smoothscroll.net/)。请在页脚保留 Argon 的名称及其链接。
