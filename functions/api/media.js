import { jsonResponse, requireAuth } from "../../lib/auth.js";
import { ensureSchema, generateId } from "../../lib/db.js";

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BASE64_LENGTH = 950000;

export async function onRequestPost({ request, env }) {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  await ensureSchema(env.DB);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "图片数据格式错误" }, 400);
  }

  const mimeType = String(body.mime_type || "image/jpeg").toLowerCase();
  if (!ALLOWED_MIMES.has(mimeType)) {
    return jsonResponse({ error: "仅支持 JPG、PNG、WebP 或 GIF 图片" }, 400);
  }

  let base64 = String(body.data_base64 || "").trim();
  const commaIdx = base64.indexOf(",");
  if (base64.startsWith("data:") && commaIdx !== -1) {
    base64 = base64.slice(commaIdx + 1);
  }

  if (!base64 || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
    return jsonResponse({ error: "无效的图片数据" }, 400);
  }
  if (base64.length > MAX_BASE64_LENGTH) {
    return jsonResponse({ error: "图片体积超出上限，请换一张小一点的图片" }, 413);
  }

  const id = generateId("media");
  const filename = String(body.filename || "cover.jpg")
    .replace(/[^\w.\-\u4e00-\u9fa5]/g, "_")
    .slice(0, 120);
  const sizeBytes = Math.floor((base64.length * 3) / 4);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO media (id, filename, mime_type, size_bytes, data_base64, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, filename, mimeType, sizeBytes, base64, now)
    .run();

  return jsonResponse(
    {
      media: {
        id,
        url: `/api/media/${id}`,
        filename,
        mime_type: mimeType,
        size_bytes: sizeBytes
      }
    },
    201
  );
}
