# Zhutingxuan 极简个人博客（Gridea Simple 风格 + 柔和粒子背景 + 在线写作后台）

致敬 [`gridea-theme-simple`](https://github.com/getgridea/gridea-theme-simple) 极简美学的云端个人博客，零服务器费用、无需绑银行卡，可直接部署到 `blog.zhutingxuan.ggff.net`。

## 特色亮点

- **经典远山固定侧边栏 + 极简宽幅图文排版**：还原 `320px` 雾山侧边栏、`38.2%` 黄金比例封面图、`740px` 舒适阅读栏与移动端平滑展开抽屉。
- **柔和动态粒子背景**：低透明度慢速漂浮粒子与微弱连线，提升质感却绝不干扰正文阅读，左下角还支持一键开关。
- **公开阅读 + 博主独享写作权限**：
  - 任何人打开网址都能自由阅读 **首页、分类、标签、归档、关于** 与所有已发布文章。
  - 仅博主点击左下角 **写作后台** 输入密码登录后，可在线发布/修改文章、管理分类与标签、上传封面图与正文插图，以及修改站点信息。

## 本地运行预览

```bash
npm run dev
```

打开 `http://127.0.0.1:8789`（本地写作后台测试密码配置在 `.dev.vars`，默认 `zhutingxuan2026`）。

## 免费部署到 Cloudflare Pages (`blog.zhutingxuan.ggff.net`)

1. 把代码上传到 GitHub 新仓库（如 `zhutingxuan-blog`，`.dev.vars` 和 `local-data/` 已被 `.gitignore` 过滤）。
2. 在 Cloudflare 左侧 **Storage & Databases → D1 SQL Database → Create**，新建数据库 `zhutingxuan-blog-db`。
3. 在 **Workers & Pages → Create → Pages → Connect to Git** 选中 `zhutingxuan-blog`：
   - **Build command**：留空
   - **Build output directory**：填 `public`
   - 点 **Save and Deploy**。
4. 在项目 **Settings** 中完成两项配置：
   - **Bindings**：添加 D1 database，Variable name 填 `DB`，选择 `zhutingxuan-blog-db`。
   - **Variables and Secrets**：添加 Secret 类型的 `APP_PASSWORD`（你的博主写作密码）和 `SESSION_SECRET`（一串随机长字符）。
   - 回到 **Deployments** 点 **Retry deployment** 生效。
5. 在项目 **Custom domains** 添加 `blog.zhutingxuan.ggff.net` 并激活，几分钟后即可访问！
