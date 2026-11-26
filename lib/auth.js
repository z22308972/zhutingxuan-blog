/**
 * 博客写作后台认证（Web Crypto HMAC-SHA256 签名 Cookie）
 */

const COOKIE_NAME = "blog_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const encoder = new TextEncoder();

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

export async function verifyPassword(inputPassword, env) {
  const expected = env?.APP_PASSWORD;
  if (!expected || typeof expected !== "string") {
    return { ok: false, configured: false };
  }
  if (typeof inputPassword !== "string" || !inputPassword) {
    return { ok: false, configured: true };
  }
  const [a, b] = await Promise.all([sha256(inputPassword), sha256(expected)]);
  return { ok: constantTimeEqual(a, b), configured: true };
}

async function getKey(env) {
  const secret =
    (env?.SESSION_SECRET && String(env.SESSION_SECRET)) ||
    `${env?.APP_PASSWORD || ""}:zhutingxuan-blog-v1`;
  const raw = await sha256(secret);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify"
  ]);
}

export async function createSessionCookie(request, env) {
  const payload = { sub: "admin", exp: Date.now() + SESSION_MAX_AGE * 1000 };
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await getKey(env);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64))
  );
  const token = `${payloadB64}.${toBase64Url(sig)}`;
  const url = new URL(request.url);
  const isHttps =
    url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE}`
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(request) {
  const url = new URL(request.url);
  const isHttps =
    url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const parts = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export async function isAuthenticated(request, env) {
  if (!env?.APP_PASSWORD) return false;
  const token = readCookie(request, COOKIE_NAME);
  if (!token || !token.includes(".")) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;
  try {
    const key = await getKey(env);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigB64),
      encoder.encode(payloadB64)
    );
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    return payload.sub === "admin" && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function requireAuth(request, env) {
  if (!env?.APP_PASSWORD) {
    return jsonResponse(
      { error: "尚未设置写作后台密码，请在 Cloudflare Pages 环境变量中添加 APP_PASSWORD" },
      503
    );
  }
  if (!(await isAuthenticated(request, env))) {
    return jsonResponse({ error: "请先登录写作后台" }, 401);
  }
  return null;
}
