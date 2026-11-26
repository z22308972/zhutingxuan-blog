import { createSessionCookie, jsonResponse, verifyPassword } from "../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "请求格式错误" }, 400);
  }

  const result = await verifyPassword(body?.password, env);
  if (!result.configured) {
    return jsonResponse(
      { error: "尚未配置写作密码，请先在 Cloudflare Pages 环境变量添加 APP_PASSWORD" },
      503
    );
  }
  if (!result.ok) {
    return jsonResponse({ error: "密码不正确，请再试一次" }, 401);
  }

  const cookie = await createSessionCookie(request, env);
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": cookie });
}
