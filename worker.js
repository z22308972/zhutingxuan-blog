/**
 * Cloudflare Workers 原生入口（搭配 [assets] 托管 public/ 静态资源 + /api/* 动态接口）
 */

import * as meRoute from "./functions/api/me.js";
import * as loginRoute from "./functions/api/login.js";
import * as logoutRoute from "./functions/api/logout.js";
import * as siteRoute from "./functions/api/site.js";
import * as postsRoute from "./functions/api/posts.js";
import * as postByIdRoute from "./functions/api/posts/[id].js";
import * as postViewRoute from "./functions/api/posts/[id]/view.js";
import * as mediaRoute from "./functions/api/media.js";
import * as mediaByIdRoute from "./functions/api/media/[id].js";
import * as taxonomiesRoute from "./functions/api/taxonomies.js";
import * as slugRoute from "./functions/api/slug.js";

function matchRoute(pathname) {
  if (pathname === "/api/me") return { mod: meRoute, params: {} };
  if (pathname === "/api/login") return { mod: loginRoute, params: {} };
  if (pathname === "/api/logout") return { mod: logoutRoute, params: {} };
  if (pathname === "/api/site") return { mod: siteRoute, params: {} };
  if (pathname === "/api/posts") return { mod: postsRoute, params: {} };
  if (pathname === "/api/media") return { mod: mediaRoute, params: {} };
  if (pathname === "/api/taxonomies") return { mod: taxonomiesRoute, params: {} };
  if (pathname === "/api/slug") return { mod: slugRoute, params: {} };

  const postViewMatch = pathname.match(/^\/api\/posts\/([^/]+)\/view$/);
  if (postViewMatch) return { mod: postViewRoute, params: { id: decodeURIComponent(postViewMatch[1]) } };

  const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch) return { mod: postByIdRoute, params: { id: decodeURIComponent(postMatch[1]) } };

  const mediaMatch = pathname.match(/^\/api\/media\/([^/]+)$/);
  if (mediaMatch) return { mod: mediaByIdRoute, params: { id: decodeURIComponent(mediaMatch[1]) } };

  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = matchRoute(url.pathname);

    if (route) {
      const methodKey =
        "onRequest" +
        request.method.charAt(0).toUpperCase() +
        request.method.slice(1).toLowerCase();
      const handler = route.mod[methodKey] || route.mod.onRequest;
      if (!handler) {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });
      }
      return handler({
        request,
        env,
        params: route.params,
        waitUntil: ctx.waitUntil.bind(ctx)
      });
    }

    if (env.ASSETS) {
      if (url.pathname === "/studio" || url.pathname === "/studio/") {
        const studioUrl = new URL("/studio.html", url.origin);
        return env.ASSETS.fetch(new Request(studioUrl, request));
      }
      return env.ASSETS.fetch(request);
    }
    return new Response("Not Found", { status: 404 });
  }
};
