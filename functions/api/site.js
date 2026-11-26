import { jsonResponse, requireAuth } from "../../lib/auth.js";
import { DEFAULT_SITE_SETTINGS, ensureSchema, getSiteSettings } from "../../lib/db.js";

export async function onRequestGet({ env }) {
  try {
    const settings = await getSiteSettings(env.DB);
    return jsonResponse({ settings });
  } catch (err) {
    if (err.message === "DB_NOT_BOUND") {
      return jsonResponse({ settings: DEFAULT_SITE_SETTINGS, dbBound: false });
    }
    throw err;
  }
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

  const allowedKeys = Object.keys(DEFAULT_SITE_SETTINGS);
  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      const val = String(body[key]).slice(0, key === "aboutContent" ? 50000 : 300);
      await env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
        .bind(key, val)
        .run();
    }
  }

  const settings = await getSiteSettings(env.DB);
  return jsonResponse({ settings });
}
