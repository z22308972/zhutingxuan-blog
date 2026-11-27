import { jsonResponse } from "../../../../lib/auth.js";
import { ensureSchema } from "../../../../lib/db.js";

export async function onRequestPost({ env, params }) {
  try {
    await ensureSchema(env.DB);
  } catch (err) {
    if (err.message === "DB_NOT_BOUND") {
      return jsonResponse({ error: "未绑定 D1 数据库" }, 503);
    }
    throw err;
  }

  const key = params.id;
  const row = await env.DB.prepare(
    `SELECT id, slug, views, published FROM posts WHERE id = ? OR slug = ?`
  )
    .bind(key, key)
    .first();

  if (!row) {
    return jsonResponse({ error: "文章不存在" }, 404);
  }

  if (!row.published) {
    return jsonResponse({
      ok: true,
      id: row.id,
      slug: row.slug,
      views: Number(row.views || 0)
    });
  }

  await env.DB.prepare(
    `UPDATE posts SET views = COALESCE(views, 0) + 1 WHERE id = ?`
  )
    .bind(row.id)
    .run();

  const updated = await env.DB.prepare(`SELECT views FROM posts WHERE id = ?`)
    .bind(row.id)
    .first();

  return jsonResponse({
    ok: true,
    id: row.id,
    slug: row.slug,
    views: Number(updated?.views ?? Number(row.views || 0) + 1)
  });
}
