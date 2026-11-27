/**
 * 零依赖本地博客开发服务器（Node 23 内置 SQLite，直接运行与 Cloudflare Pages 相同的 API 代码）
 * 启动命令：npm run dev
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "local-data");
const DB_PATH = path.join(DATA_DIR, "blog.sqlite");
const PORT = Number(process.env.PORT || 8789);

function loadDevVars() {
  const vars = { ...process.env };
  const file = path.join(__dirname, ".dev.vars");
  if (fs.existsSync(file)) {
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (!(k in vars)) vars[k] = v;
    }
  }
  return vars;
}

function createD1Shim(sqlite) {
  return {
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...a) {
          args = a;
          return stmt;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args), success: true };
        },
        async first() {
          return sqlite.prepare(sql).get(...args) ?? null;
        },
        async run() {
          return { success: true, meta: sqlite.prepare(sql).run(...args) };
        }
      };
      return stmt;
    }
  };
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const sqlite = new DatabaseSync(DB_PATH);
const devVars = loadDevVars();
const env = {
  APP_PASSWORD: devVars.APP_PASSWORD || "zhutingxuan2026",
  SESSION_SECRET: devVars.SESSION_SECRET || "local-blog-dev-secret",
  DB: createD1Shim(sqlite)
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

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

async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function sendStatic(pathname, res) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let full = path.resolve(PUBLIC_DIR, rel);
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    if (!path.extname(rel)) {
      full = path.join(PUBLIC_DIR, "index.html");
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(full).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    const route = matchRoute(url.pathname);
    if (route) {
      const key =
        "onRequest" + req.method.charAt(0).toUpperCase() + req.method.slice(1).toLowerCase();
      const handler = route.mod[key] || route.mod.onRequest;
      if (!handler) {
        res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Method Not Allowed" }));
        return;
      }

      const body = await readBody(req);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
        else if (v !== undefined) headers.set(k, v);
      }

      const webRes = await handler({
        request: new Request(url.toString(), { method: req.method, headers, body }),
        env,
        params: route.params
      });

      const outHeaders = {};
      webRes.headers.forEach((v, k) => {
        if (k.toLowerCase() !== "set-cookie") outHeaders[k] = v;
      });
      const cookies =
        typeof webRes.headers.getSetCookie === "function" ? webRes.headers.getSetCookie() : [];
      if (cookies.length > 0) outHeaders["set-cookie"] = cookies;

      res.writeHead(webRes.status, outHeaders);
      res.end(Buffer.from(await webRes.arrayBuffer()));
      return;
    }
    sendStatic(url.pathname, res);
  } catch (err) {
    console.error("[blog dev-server error]", err);
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: err.message || "Internal Server Error" }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`极简个人博客本地预览已启动：http://127.0.0.1:${PORT}`);
  console.log(`本地 SQLite 数据库：${DB_PATH}`);
});
