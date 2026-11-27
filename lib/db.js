/**
 * 博客数据库初始化、默认站点配置与首发文章（含分类与标签）
 */

export const DEFAULT_SITE_SETTINGS = {
  siteName: "Zhutingxuan",
  avatarText: "ZT",
  avatarUrl: "",
  motto: "温故而知新，慢行亦有风",
  footerText: "blog.zhutingxuan.ggff.net",
  github: "",
  bilibili: "",
  email: "",
  aboutContent: `你好，我是 **Zhutingxuan**，目前生活和学习在上海。

这是一座属于我的极简个人博客，用来安静地记录日常思考、读书摘录、技术探索与城市漫步。

### 关于这个小站

- **视觉灵感**：致敬经典的 \`Gridea Simple\` 极简留白美学，搭配轻柔的动态粒子背景，让阅读既灵动又不刺眼。
- **权限与写作**：所有文章面向访客自由阅读；仅我本人通过密码进入写作后台，即可在线用 Markdown 写作、上传封面与配图、管理分类与标签。
- **零成本云端架构**：托管在 **Cloudflare Pages + 免费 D1 数据库**，24 小时云端在线。

> 保持好奇，持续记录，时间会替你留下答案。`
};

const SEED_POSTS = [
  {
    slug: "markdown-guide",
    title: "Markdown 简明写作指南",
    category: "效率与技术",
    abstract:
      "Markdown 是一种轻量级标记语言，它允许我们用易读易写的纯文本格式编写文档，再优雅地渲染成干净舒适的网页排版。",
    cover: "/assets/cover-markdown.jpg",
    tags: ["写作", "Markdown"],
    published_at: "2026-11-27",
    content: `Markdown 是一种轻量级标记语言，它允许我们用极简的纯文本符号表达标题、列表、引用和代码块，让我们在写博客时完全专注于文字本身。

### 常用排版语法

1. **标题**：在文字前加 \`#\` 到 \`####\` 即可创建不同层级的标题。
2. **强调**：用 \`**加粗文字**\` 强调重点，用 \`*斜体文字*\` 标注引述。
3. **待办清单**：非常适合记录阶段性学习目标：

- [x] 拥有自己的专属域名 \`zhutingxuan.ggff.net\`
- [x] 搭建同款极简高颜值的个人博客
- [ ] 写下第一篇属于自己的原创文章

### 引用与代码片段

> 「写下来，本身就是把模糊的想法变得清晰的过程。」

如果你要记录代码，可以用三个反引号包裹：

\`\`\`javascript
function greet(visitor) {
  return \`欢迎来到 \${visitor} 的极简博客\`;
}
\`\`\`

### 如何发表与修改文章

点击左侧栏底部的 **写作后台** 输入你的专属密码登录，即可在线新建文章、选择分类和标签、上传封面与插图，并实时预览排版效果。`
  },
  {
    slug: "shanghai-twilight-notes",
    title: "浦东暮色与城市漫步随记",
    category: "城市随笔",
    abstract:
      "傍晚沿着江边走过，天空从浅青渐变成柔和的琥珀色。记录几个在喧闹城市里偷得浮生半日闲的安静瞬间。",
    cover: "/assets/cover-shanghai.jpg",
    tags: ["生活", "上海", "摄影"],
    published_at: "2026-11-24",
    content: `秋末的上海总有几天格外通透。傍晚五点刚过，江风带着微凉的水汽吹过来，天边慢慢晕开一层青灰与暖橙交织的暮色。

### 慢下来看熟悉的地方

平时匆匆路过的街道，只要稍微放慢脚步，总能发现不一样的细节：

- 写字楼玻璃幕墙折射出的最后一道落日余晖
- 滨江步道上慢跑的身影与耳机里恰好播到的老歌
- 便利店门口刚出炉的热拿铁香气

> 生活里值得记住的，往往不是宏大的瞬间，而是这些刚好被心情接住的片段。

有了自己的独立博客以后，这些随手拍下的照片和几百字的碎碎念，终于有了一个安静、不被算法打扰的归宿。`
  },
  {
    slug: "build-my-digital-garden",
    title: "从零搭建我的第一座数字花园",
    category: "数字花园",
    abstract:
      "从领取第一枚域名到拥有个人主页、私人云笔记和极简博客，记录这趟零成本云端折腾之旅的收获与想法。",
    cover: "/assets/cover-desk.jpg",
    tags: ["建站", "Cloudflare", "折腾"],
    published_at: "2026-11-20",
    content: `以前总觉得「拥有自己的网站」是一件需要买服务器、学运维的复杂工程；真正动手做下来才发现，借助现代云平台，一切比想象中轻盈得多。

### 我的免费云端小站组合

| 子域名 | 用途 | 特点 |
| --- | --- | --- |
| \`zhutingxuan.ggff.net\` | 个人主页 | 极简白底卡片名片 |
| \`blog.zhutingxuan.ggff.net\` | 极简博客 | 远山侧边栏 + 在线写作发布 |
| \`note.zhutingxuan.ggff.net\` | 私人云笔记 | 密码登录 + Markdown 实时预览 |

### 为什么要坚持写博客？

社交平台上的动态像流水，很快会被新的信息冲走；而独立博客像一间自己布置的书房——界面安静、排版舒适、所有文章都属于自己。

希望未来的日子里，这里能一点点装满新的阅读、新的项目和新的风景。`
  }
];

export function generateId(prefix = "id") {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Date.now().toString(36)}_${Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0")
  ).join("")}`;
}

export function slugify(input) {
  const base = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `post-${Date.now().toString(36)}`;
}

export function parseTags(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function serializePost(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    abstract: row.abstract || "",
    content: row.content || "",
    cover: row.cover || "",
    category: row.category || "随笔",
    tags: parseTags(row.tags),
    views: Number(row.views || 0),
    published: Boolean(row.published),
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function ensureSchema(db) {
  if (!db) throw new Error("DB_NOT_BOUND");

  await db
    .prepare(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
    .run();

  await db
    .prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        abstract TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        cover TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '随笔',
        tags TEXT NOT NULL DEFAULT '[]',
        views INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 1,
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    )
    .run();

  // 兼容已有数据库：若旧表无 views 列则自动补充
  const { results: postCols } = await db.prepare(`PRAGMA table_info(posts)`).all();
  if (!(postCols || []).some((col) => col.name === "views")) {
    await db.prepare(`ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0`).run();
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL DEFAULT 'image.jpg',
        mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
        size_bytes INTEGER NOT NULL DEFAULT 0,
        data_base64 TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS categories (
        name TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS tags (
        name TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_posts_pub_date ON posts (published, published_at DESC)`
    )
    .run();

  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category)`)
    .run();

  const seeded = await db
    .prepare(`SELECT value FROM meta WHERE key = ?`)
    .bind("blog_seeded")
    .first();

  if (!seeded) {
    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(DEFAULT_SITE_SETTINGS)) {
      await db
        .prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
        .bind(k, String(v))
        .run();
    }

    for (const p of SEED_POSTS) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO posts
           (id, slug, title, abstract, content, cover, category, tags, published, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId("post"),
          p.slug,
          p.title,
          p.abstract,
          p.content,
          p.cover,
          p.category,
          JSON.stringify(p.tags),
          1,
          p.published_at,
          now,
          now
        )
        .run();
    }

    await db
      .prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`)
      .bind("blog_seeded", "1")
      .run();
  }

  const taxSeeded = await db
    .prepare(`SELECT value FROM meta WHERE key = ?`)
    .bind("taxonomy_seeded")
    .first();

  if (!taxSeeded) {
    const now = new Date().toISOString();
    const { results: postRows } = await db
      .prepare(`SELECT category, tags FROM posts`)
      .all();

    const initCats = new Set(["随笔", "效率与技术", "城市随笔", "数字花园"]);
    const initTags = new Set();

    for (const row of postRows || []) {
      const c = String(row.category || "").trim();
      if (c) initCats.add(c);
      for (const t of parseTags(row.tags)) {
        const clean = String(t || "").trim();
        if (clean) initTags.add(clean);
      }
    }

    for (const name of initCats) {
      await db
        .prepare(`INSERT OR IGNORE INTO categories (name, created_at) VALUES (?, ?)`)
        .bind(name, now)
        .run();
    }
    for (const name of initTags) {
      await db
        .prepare(`INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)`)
        .bind(name, now)
        .run();
    }

    await db
      .prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`)
      .bind("taxonomy_seeded", "1")
      .run();
  }
}

export async function ensureTaxonomyEntries(db, category, tags = []) {
  const now = new Date().toISOString();
  const cat = String(category || "").trim().slice(0, 32);
  if (cat && cat !== "未分类") {
    await db
      .prepare(`INSERT OR IGNORE INTO categories (name, created_at) VALUES (?, ?)`)
      .bind(cat, now)
      .run();
  }
  for (const raw of tags || []) {
    const tag = String(raw || "").trim().slice(0, 24);
    if (tag) {
      await db
        .prepare(`INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)`)
        .bind(tag, now)
        .run();
    }
  }
}

export async function getTaxonomies(db) {
  await ensureSchema(db);
  const [{ results: catRows }, { results: tagRows }, { results: postRows }] = await Promise.all([
    db.prepare(`SELECT name, created_at FROM categories ORDER BY created_at ASC, name ASC`).all(),
    db.prepare(`SELECT name, created_at FROM tags ORDER BY created_at ASC, name ASC`).all(),
    db.prepare(`SELECT category, tags, published FROM posts`).all()
  ]);

  const catCounts = new Map();
  const catPubCounts = new Map();
  const tagCounts = new Map();
  const tagPubCounts = new Map();

  for (const p of postRows || []) {
    const c = String(p.category || "随笔").trim() || "随笔";
    catCounts.set(c, (catCounts.get(c) || 0) + 1);
    if (p.published) catPubCounts.set(c, (catPubCounts.get(c) || 0) + 1);

    for (const t of parseTags(p.tags)) {
      const clean = String(t || "").trim();
      if (!clean) continue;
      tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
      if (p.published) tagPubCounts.set(clean, (tagPubCounts.get(clean) || 0) + 1);
    }
  }

  const categories = (catRows || []).map((r) => ({
    name: r.name,
    count: catCounts.get(r.name) || 0,
    publishedCount: catPubCounts.get(r.name) || 0,
    created_at: r.created_at
  }));

  const tags = (tagRows || []).map((r) => ({
    name: r.name,
    count: tagCounts.get(r.name) || 0,
    publishedCount: tagPubCounts.get(r.name) || 0,
    created_at: r.created_at
  }));

  return { categories, tags };
}

export async function getSiteSettings(db) {
  await ensureSchema(db);
  const { results } = await db.prepare(`SELECT key, value FROM settings`).all();
  const merged = { ...DEFAULT_SITE_SETTINGS };
  for (const row of results || []) {
    if (row.key in merged) merged[row.key] = row.value;
  }
  return merged;
}
