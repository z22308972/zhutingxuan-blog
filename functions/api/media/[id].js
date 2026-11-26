import { jsonResponse, requireAuth } from "../../../lib/auth.js";
import { ensureSchema } from "../../../lib/db.js";

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function onRequestGet({ env, params }) {
  await ensureSchema(env.DB);
  const row = await env.DB.prepare(`SELECT mime_type, data_base64 FROM media WHERE id = ?`)
    .bind(params.id)
    .first();

  if (!row) return new Response("Not Found", { status: 404 });

  return new Response(base64ToUint8Array(row.data_base64), {
    status: 200,
    headers: {
      "Content-Type": row.mime_type || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function onRequestDelete({ request, env, params }) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);
  await env.DB.prepare(`DELETE FROM media WHERE id = ?`).bind(params.id).run();
  return jsonResponse({ ok: true });
}
