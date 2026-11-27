import { jsonResponse, requireAuth } from "../../lib/auth.js";
import { ensureSchema, generateEnglishSlug } from "../../lib/db.js";

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

  const source = String(body.text || body.title || "").trim();
  if (!source) {
    return jsonResponse({ error: "请先输入文章标题" }, 400);
  }

  const excludeId = String(body.excludeId || "").trim();
  let slug = await generateEnglishSlug(source);

  const conflict = excludeId
    ? await env.DB.prepare(`SELECT id FROM posts WHERE slug = ? AND id != ?`)
        .bind(slug, excludeId)
        .first()
    : await env.DB.prepare(`SELECT id FROM posts WHERE slug = ?`).bind(slug).first();

  if (conflict) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  return jsonResponse({ ok: true, slug });
}
