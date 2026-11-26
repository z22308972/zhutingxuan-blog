-- 极简个人博客数据库结构（Cloudflare D1 / SQLite 通用，含分类、标签与媒体表）

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '随笔',
  tags TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 1,
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL DEFAULT 'image.jpg',
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  data_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_pub_date ON posts (published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category);
