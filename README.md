# QBlog Spectre

基于 [Spectre](https://github.com/louisescher/spectre) 主题改造的 Astro 静态博客，目标部署平台是 GitHub Pages。

## 本地启动

```bash
npm install
cp .env.example .env
# 把 .env 里的 SITE_PASSWORD 改成你自己的固定密码
npm run dev
```

默认地址：

```text
http://localhost:4321
```

## 全站密码访问

项目已经接入全站固定密码门禁，密码来源是构建时环境变量 `SITE_PASSWORD`。

本地开发：

```bash
cp .env.example .env
```

然后编辑 `.env`：

```text
SITE_PASSWORD=你的固定密码
```

GitHub Pages 部署：

1. 打开仓库 `Settings > Secrets and variables > Actions`
2. 新建一个 Secret，名称填 `SITE_PASSWORD`
3. 值填你要使用的固定密码

说明：

- 当前是静态站前端门禁，适合低强度访问限制
- 它不是服务端鉴权，不能提供真正的安全保护
- 如果不配置 `SITE_PASSWORD`，站点会退回默认密码 `please-change-me`

## Unsplash 真图封面

项目现在支持把文章 / 项目封面批量替换成 Unsplash 真图，但抓图发生在本地脚本执行阶段，最后会下载到仓库里的本地静态资源，不会在 GitHub Pages 运行时调用 Unsplash API。

先在 `.env` 里补上：

```text
UNSPLASH_ACCESS_KEY=你的AccessKey
```

然后执行：

```bash
npm run images:unsplash
```

如果你用的是 Unsplash demo 配额，建议分批跑：

```bash
npm run images:unsplash -- --limit=20
```

脚本会：

- 根据文章 slug / tag 自动挑选查询词
- 从 Unsplash `random` 接口抓取横版图片
- 下载到 `src/content/assets/unsplash/`
- 自动回写文章 frontmatter 的 `image`、`imageAlt`、`imageCredit`

这样做的好处是：

- 不暴露 Access Key
- 发布后的站点不依赖运行时第三方 API
- 封面图稳定，不会每次刷新随机变化

注意：

- Unsplash demo 应用通常有每小时 50 次 API 请求限制
- 当前脚本每张图会消耗 2 次请求：1 次取随机图，1 次下载统计
- 所以一次建议最多处理 20 张左右，跑完后过一小时再继续执行

## 构建检查

```bash
npm run build
npm run check
```

## GitHub Pages 部署

1. 创建 GitHub 仓库并推送代码到 `main`
2. 打开仓库 `Settings > Pages`
3. `Build and deployment` 选择 `GitHub Actions`
4. 之后每次 push 到 `main` 都会触发 [deploy.yml](/Users/cqmike/qblog/.github/workflows/deploy.yml)

项目已经在 [astro.config.ts](/Users/cqmike/qblog/astro.config.ts) 里自动处理两类 Pages 地址：

- 用户站点：`https://<user>.github.io/`
- 项目站点：`https://<user>.github.io/<repo>/`

如果你要绑定自定义域名，增加仓库变量：

```text
SITE_URL=https://your-domain.com
```

然后在 `public/` 下补一个 `CNAME` 文件即可。

## 内容目录

- 文章：`src/content/posts/`
- 项目：`src/content/projects/`
- 标签：`src/content/tags.json`
- 个人简介：`src/content/other/about.mdx`
- 首页资料：`src/content/info.json`
- 社交链接：`src/content/socials.json`
- 经历：`src/content/work.json`

## 新增文章

```mdx
---
title: "文章标题"
description: "一句摘要"
image: "../assets/spectre.png"
createdAt: 2026-04-21
updatedAt: 2026-04-21
draft: false
tags:
  - astro
  - blog
---

正文内容
```

注意：

- `tags` 必须先在 `src/content/tags.json` 里定义
- `image` 推荐放在 `src/content/assets/`
- 文件名就是最终文章 slug

## 数据迁移

如果你有旧的 Hexo 博客，可以直接执行：

```bash
npm run import:hexo
```

默认会从 `../blog/` 读取：

- `source/_posts/` 导入文章
- `source/about/index.md` 导入关于页内容
- `source/CNAME` 导入自定义域名

同时会自动：

1. 重建 `src/content/posts/`
2. 重建 `src/content/tags.json`
3. 为旧 Hexo permalink `/:year/:month/:day/:title/` 生成静态跳转页

如果你不是从 Hexo 迁移，仍然只需要做三件事：

1. 把旧文章转成 MD 或 MDX
2. 补齐 Spectre 要求的 frontmatter
3. 把正文图片搬到 `src/content/assets/` 或 `public/`
