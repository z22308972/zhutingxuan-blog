import { jsonResponse, requireAuth } from "../../lib/auth.js";
import { ensureSchema, getTaxonomies, parseTags } from "../../lib/db.js";

function cleanName(kind, raw) {
  const maxLen = kind === "category" ? 32 : 24;
  return String(raw || "").trim().slice(0, maxLen);
}

export async function onRequestGet({ env }) {
  try {
    const data = await getTaxonomies(env.DB);
    return jsonResponse(data);
  } catch (err) {
    if (err.message === "DB_NOT_BOUND") {
      return jsonResponse({ categories: [], tags: [], dbBound: false });
    }
    throw err;
  }
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

  const kind = body.kind === "tag" ? "tag" : body.kind === "category" ? "category" : null;
  if (!kind) return jsonResponse({ error: "无效的类型参数" }, 400);

  const name = cleanName(kind, body.name);
  if (!name) {
    return jsonResponse({ error: kind === "category" ? "分类名称不能为空" : "标签名称不能为空" }, 400);
  }

  const table = kind === "category" ? "categories" : "tags";
  const exists = await env.DB.prepare(`SELECT name FROM ${table} WHERE name = ?`).bind(name).first();
  if (exists) {
    return jsonResponse(
      { error: kind === "category" ? `分类「${name}」已存在` : `标签「${name}」已存在` },
      409
    );
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO ${table} (name, created_at) VALUES (?, ?)`)
    .bind(name, now)
    .run();

  const data = await getTaxonomies(env.DB);
  return jsonResponse({ ok: true, kind, name, ...data }, 201);
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "请求格式错误" }, 400);
  }

  const kind = body.kind === "tag" ? "tag" : body.kind === "category" ? "category" : null;
  if (!kind) return jsonResponse({ error: "无效的类型参数" }, 400);

  const oldName = cleanName(kind, body.oldName);
  const newName = cleanName(kind, body.newName);
  if (!oldName || !newName) {
    return jsonResponse({ error: "名称不能为空" }, 400);
  }
  if (oldName === newName) {
    const data = await getTaxonomies(env.DB);
    return jsonResponse({ ok: true, ...data });
  }

  const table = kind === "category" ? "categories" : "tags";
  const conflict = await env.DB.prepare(`SELECT name FROM ${table} WHERE name = ?`).bind(newName).first();
  if (conflict) {
    return jsonResponse(
      { error: kind === "category" ? `分类「${newName}」已存在` : `标签「${newName}」已存在` },
      409
    );
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT OR IGNORE INTO ${table} (name, created_at) VALUES (?, ?)`)
    .bind(newName, now)
    .run();
  await env.DB.prepare(`DELETE FROM ${table} WHERE name = ?`).bind(oldName).run();

  if (kind === "category") {
    await env.DB.prepare(`UPDATE posts SET category = ? WHERE category = ?`)
      .bind(newName, oldName)
      .run();
  } else {
    const { results } = await env.DB.prepare(`SELECT id, tags FROM posts`).all();
    for (const row of results || []) {
      const list = parseTags(row.tags);
      if (list.includes(oldName)) {
        const next = [];
        for (const t of list) {
          const mapped = t === oldName ? newName : t;
          if (mapped && !next.includes(mapped)) next.push(mapped);
        }
        await env.DB.prepare(`UPDATE posts SET tags = ? WHERE id = ?`)
          .bind(JSON.stringify(next), row.id)
          .run();
      }
    }
  }

  const data = await getTaxonomies(env.DB);
  return jsonResponse({ ok: true, ...data });
}

export async function onRequestDelete({ request, env }) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);

  const url = new URL(request.url);
  let kind = url.searchParams.get("kind");
  let name = url.searchParams.get("name");

  if (!kind || !name) {
    try {
      const body = await request.json();
      kind = kind || body.kind;
      name = name || body.name;
    } catch {
      // ignore empty body
    }
  }

  kind = kind === "tag" ? "tag" : kind === "category" ? "category" : null;
  if (!kind) return jsonResponse({ error: "无效的类型参数" }, 400);

  name = cleanName(kind, name);
  if (!name) return jsonResponse({ error: "名称不能为空" }, 400);

  const table = kind === "category" ? "categories" : "tags";
  await env.DB.prepare(`DELETE FROM ${table} WHERE name = ?`).bind(name).run();

  if (kind === "category") {
    await env.DB.prepare(`UPDATE posts SET category = ? WHERE category = ?`)
      .bind("未分类", name)
      .run();
  } else {
    const { results } = await env.DB.prepare(`SELECT id, tags FROM posts`).all();
    for (const row of results || []) {
      const list = parseTags(row.tags);
      if (list.includes(name)) {
        const next = list.filter((t) => t !== name);
        await env.DB.prepare(`UPDATE posts SET tags = ? WHERE id = ?`)
          .bind(JSON.stringify(next), row.id)
          .run();
      }
    }
  }

  const data = await getTaxonomies(env.DB);
  return jsonResponse({ ok: true, ...data });
}
