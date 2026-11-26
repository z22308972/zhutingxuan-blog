import { clearSessionCookie, jsonResponse } from "../../lib/auth.js";

export async function onRequestPost({ request }) {
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
}
