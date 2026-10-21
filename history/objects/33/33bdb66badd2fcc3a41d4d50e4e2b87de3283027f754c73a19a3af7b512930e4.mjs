// 校园值班台 · 本地静态服务（Node 22 自带模块，无第三方依赖）
// 用法：在项目根目录执行  node tools/serve.mjs
// 只公开 frontend 目录；/api/* 转发到本机后端 127.0.0.1:8098。

import http from "node:http";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, "..", "frontend");

const HOST = "127.0.0.1";
const PORT = 5188;

const API_TARGET = { host: "127.0.0.1", port: 8098 };

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function log(...args) {
  console.log(`[serve] ${new Date().toISOString()}`, ...args);
}

function sendText(res, status, text) {
  const body = Buffer.from(text, "utf8");
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function sendApiError(res, status, message) {
  const body = Buffer.from(
    JSON.stringify({ code: -1, message, data: null }),
    "utf8"
  );
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

// 把 URL 路径转成 frontend 内的安全绝对路径；不合法返回 null。
function resolveInsideFrontend(rawPathname) {
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }

  if (pathname.includes("\0")) return null;

  const segments = pathname.split("/").filter((s) => s.length > 0);
  // 隐藏文件/目录（.env、.git 等）一律不公开
  if (segments.some((s) => s.startsWith("."))) return null;
  if (pathname.includes("\\")) return null;

  const relative = segments.join("/");
  const absolute = path.resolve(FRONTEND_ROOT, relative);

  const rootWithSep = FRONTEND_ROOT + path.sep;
  if (absolute !== FRONTEND_ROOT && !absolute.startsWith(rootWithSep)) {
    return null;
  }
  return absolute;
}

async function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendText(res, 405, "405 仅支持 GET 和 HEAD 请求。");
    return;
  }

  const target = resolveInsideFrontend(pathname);
  if (!target) {
    log("拒绝访问", pathname);
    sendText(res, 403, "403 该路径不在 frontend 目录的公开范围内。");
    return;
  }

  let filePath = target;
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    sendText(res, 404, `404 未找到 ${pathname}。`);
    return;
  }

  // 用真实路径二次校验，避免符号链接跳出 frontend
  let realFile;
  let realRoot;
  try {
    realRoot = await fs.realpath(FRONTEND_ROOT);
    realFile = await fs.realpath(filePath);
  } catch {
    sendText(res, 404, `404 未找到 ${pathname}。`);
    return;
  }
  if (!realFile.startsWith(realRoot + path.sep)) {
    log("拒绝符号链接越界", pathname);
    sendText(res, 403, "403 该路径不在 frontend 目录的公开范围内。");
    return;
  }

  let stat;
  try {
    stat = await fs.stat(realFile);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    sendText(res, 404, `404 未找到 ${pathname}。`);
    return;
  }

  const ext = path.extname(realFile).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(realFile);
  stream.on("error", (err) => {
    log("读取失败", realFile, err.message);
    res.destroy();
  });
  stream.pipe(res);
}

function proxyApi(req, res) {
  const options = {
    host: API_TARGET.host,
    port: API_TARGET.port,
    method: req.method,
    path: req.url, // 原样保留 /api 前缀和查询串
    headers: {
      ...req.headers,
      host: `${API_TARGET.host}:${API_TARGET.port}`,
    },
  };

  const upstream = http.request(options, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstream.on("error", (err) => {
    const refused =
      err.code === "ECONNREFUSED" || err.code === "EHOSTUNREACH";
    const message = refused
      ? "后端服务不可用：请确认 127.0.0.1:8098 已启动（终端 B 运行 Spring Boot 后重试）。"
      : `后端请求失败：${err.message}`;
    log("代理失败", req.url, err.code || err.message);
    if (!res.headersSent) {
      sendApiError(res, 503, message);
    } else {
      res.destroy();
    }
  });

  req.pipe(upstream);
  req.on("aborted", () => upstream.destroy());
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  log(req.method, req.url);

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  serveStatic(req, res, pathname).catch((err) => {
    log("未处理错误", err);
    if (!res.headersSent) sendText(res, 500, "500 服务内部错误。");
    else res.destroy();
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[serve] 端口 ${PORT} 已被占用。请先关闭占用该端口的旧服务，再重新运行。`
    );
  } else {
    console.error("[serve] 启动失败：", err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[serve] 前端地址：http://${HOST}:${PORT}`);
  console.log(`[serve] 静态目录：${FRONTEND_ROOT}`);
  console.log(`[serve] 接口转发：/api/* -> http://${API_TARGET.host}:${API_TARGET.port}`);
  console.log("[serve] 按 Ctrl+C 停止。");
});
