import { isAuthenticated, jsonResponse, requireAuth } from "../../lib/auth.js";
import { ensureSchema, ensureTaxonomyEntries, generateId, serializePost, slugify } from "../../lib/db.js";

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const clean = [];
  for (const t of tags) {
    const v = String(t || "").trim().slice(0, 24);
    if (v && !clean.includes(v) && clean.length < 10) clean.push(v);
  }
  return clean;
}

export async function onRequestGet({ request, env }) {
  try {
    await ensureSchema(env.DB);
  } catch (err) {
    if (err.message === "DB_NOT_BOUND") {
      return jsonResponse(
        { error: "未绑定 D1 数据库，请在 Cloudflare Pages 中绑定变量名 DB" },
        503
      );
    }
    throw err;
  }

  const url = new URL(request.url);
  const wantAll = url.searchParams.get("all") === "1";
  const isAdmin = wantAll ? await isAuthenticated(request, env) : false;

  const sql = isAdmin
    ? `SELECT * FROM posts ORDER BY published_at DESC, created_at DESC`
    : `SELECT * FROM posts WHERE published = 1 ORDER BY published_at DESC, created_at DESC`;

  const { results } = await env.DB.prepare(sql).all();
  const posts = (results || []).map(serializePost);
  return jsonResponse({ posts });
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "请求格式错误" }, 400);
  }

  const title = String(body.title || "").trim().slice(0, 200);
  if (!title) {
    return jsonResponse({ error: "文章标题不能为空" }, 400);
  }

  const now = new Date().toISOString();
  const id = generateId("post");
  let slug = slugify(body.slug || title);
  const existingSlug = await env.DB.prepare(`SELECT id FROM posts WHERE slug = ?`)
    .bind(slug)
    .first();
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const abstract = String(body.abstract || "").trim().slice(0, 400);
  const content = String(body.content || "").slice(0, 400000);
  const cover = String(body.cover || "").trim().slice(0, 500);
  const category = String(body.category || "").trim().slice(0, 32) || "随笔";
  const tags = sanitizeTags(body.tags);
  const published = body.published === false ? 0 : 1;
  const published_at =
    String(body.published_at || "").trim().slice(0, 32) || now.slice(0, 10);

  await env.DB.prepare(
    `INSERT INTO posts
     (id, slug, title, abstract, content, cover, category, tags, published, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      slug,
      title,
      abstract,
      content,
      cover,
      category,
      JSON.stringify(tags),
      published,
      published_at,
      now,
      now
    )
    .run();

  await ensureTaxonomyEntries(env.DB, category, tags);

  return jsonResponse(
    {
      post: {
        id,
        slug,
        title,
        abstract,
        content,
        cover,
        category,
        tags,
        views: 0,
        published: Boolean(published),
        published_at,
        created_at: now,
        updated_at: now
      }
    },
    201
  );
}
