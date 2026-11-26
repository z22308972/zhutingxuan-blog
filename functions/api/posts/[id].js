import { isAuthenticated, jsonResponse, requireAuth } from "../../../lib/auth.js";
import { ensureSchema, parseTags, serializePost, slugify } from "../../../lib/db.js";

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const clean = [];
  for (const t of tags) {
    const v = String(t || "").trim().slice(0, 24);
    if (v && !clean.includes(v) && clean.length < 10) clean.push(v);
  }
  return clean;
}

export async function onRequestGet({ request, env, params }) {
  await ensureSchema(env.DB);
  const key = params.id;
  const row = await env.DB.prepare(`SELECT * FROM posts WHERE id = ? OR slug = ?`)
    .bind(key, key)
    .first();

  if (!row) return jsonResponse({ error: "文章不存在" }, 404);
  if (!row.published && !(await isAuthenticated(request, env))) {
    return jsonResponse({ error: "文章不存在" }, 404);
  }
  return jsonResponse({ post: serializePost(row) });
}

export async function onRequestPut({ request, env, params }) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);

  const existing = await env.DB.prepare(`SELECT * FROM posts WHERE id = ?`)
    .bind(params.id)
    .first();
  if (!existing) return jsonResponse({ error: "文章不存在" }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "请求格式错误" }, 400);
  }

  const now = new Date().toISOString();
  const title =
    body.title !== undefined ? String(body.title).trim().slice(0, 200) : existing.title;
  if (!title) return jsonResponse({ error: "文章标题不能为空" }, 400);

  let slug = existing.slug;
  if (body.slug !== undefined && String(body.slug).trim()) {
    const candidate = slugify(body.slug);
    const conflict = await env.DB.prepare(`SELECT id FROM posts WHERE slug = ? AND id != ?`)
      .bind(candidate, params.id)
      .first();
    slug = conflict ? `${candidate}-${Date.now().toString(36).slice(-4)}` : candidate;
  }

  const abstract =
    body.abstract !== undefined
      ? String(body.abstract).trim().slice(0, 400)
      : existing.abstract;
  const content =
    body.content !== undefined ? String(body.content).slice(0, 400000) : existing.content;
  const cover =
    body.cover !== undefined ? String(body.cover).trim().slice(0, 500) : existing.cover;
  const category =
    body.category !== undefined
      ? String(body.category).trim().slice(0, 32) || "随笔"
      : existing.category || "随笔";
  const tags =
    body.tags !== undefined ? sanitizeTags(body.tags) : parseTags(existing.tags);
  const published =
    body.published !== undefined ? (body.published ? 1 : 0) : existing.published;
  const published_at =
    body.published_at !== undefined && String(body.published_at).trim()
      ? String(body.published_at).trim().slice(0, 32)
      : existing.published_at;

  await env.DB.prepare(
    `UPDATE posts
     SET slug = ?, title = ?, abstract = ?, content = ?, cover = ?, category = ?, tags = ?, published = ?, published_at = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
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
      params.id
    )
    .run();

  return jsonResponse({
    post: {
      id: params.id,
      slug,
      title,
      abstract,
      content,
      cover,
      category,
      tags,
      published: Boolean(published),
      published_at,
      created_at: existing.created_at,
      updated_at: now
    }
  });
}

export async function onRequestDelete({ request, env, params }) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);

  await env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(params.id).run();
  return jsonResponse({ ok: true });
}
