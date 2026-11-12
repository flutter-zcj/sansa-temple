#!/usr/bin/env node
/**
 * 山寺 · 单端口网关
 *
 * 把三个独立产物收进同一个 HTTP 端口：
 *   1. 落地页            GET  /                     （内联页，无外部依赖）
 *   2. 静态原型          GET  /proto/*              → prototype/
 *   3. uni-app H5 产物   GET  /app/                 → web/dist/build/h5/index.html
 *                        GET  /assets/* /static/*  → web/dist/build/h5/（产物使用绝对路径引用）
 *   4. FastAPI 后端      ANY  /api/*                → 反向代理 127.0.0.1:8000
 *                        WS   /ws/*                 → TCP 透传 127.0.0.1:8000
 *
 * 只依赖 Node 内置模块，无需 npm install。
 *
 * 用法：
 *   node deploy/sandbox/server.js
 *   PORT=9000 API_PORT=8001 node deploy/sandbox/server.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

/* ---------------------------------------------------------------- 配置 */

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8080);
const BIND = process.env.BIND || '0.0.0.0';
const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = Number(process.env.API_PORT || 8000);
const API_TIMEOUT = Number(process.env.API_TIMEOUT || 30000);

const UNI_DIR = path.join(ROOT, 'web', 'dist', 'build', 'h5');
const PROTO_DIR = path.join(ROOT, 'prototype');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

/* ------------------------------------------------------------ 静态文件 */

/**
 * 把 URL 路径安全地解析为磁盘路径，拒绝越界访问。
 * @param {string} root 允许的根目录
 * @param {string} pathname 已解码的 URL 路径（相对 root）
 * @returns {string|null} 绝对路径；越界时返回 null
 */
function safeJoin(root, pathname) {
  const rel = pathname.replace(/^\/+/, '');
  const abs = path.resolve(root, rel);
  const base = path.resolve(root);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

/**
 * 输出文件，支持 ETag 弱校验、Last-Modified 与单区间 Range。
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} file 绝对路径
 */
function sendFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res, '文件不存在');

    const ext = path.extname(file).toLowerCase();
    const etag = `W/"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ETag: etag,
      'Last-Modified': st.mtime.toUTCString(),
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    };

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }

    // Range：3D 资源与音频拖动需要
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        let start = m[1] === '' ? NaN : Number(m[1]);
        let end = m[2] === '' ? NaN : Number(m[2]);
        if (Number.isNaN(start)) {
          // bytes=-N 表示末尾 N 字节
          start = Math.max(0, st.size - (Number.isNaN(end) ? 0 : end));
          end = st.size - 1;
        } else if (Number.isNaN(end)) {
          end = st.size - 1;
        }
        if (start <= end && start < st.size) {
          end = Math.min(end, st.size - 1);
          headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
          headers['Accept-Ranges'] = 'bytes';
          headers['Content-Length'] = end - start + 1;
          res.writeHead(206, headers);
          if (req.method === 'HEAD') return res.end();
          return fs.createReadStream(file, { start, end }).pipe(res);
        }
      }
    }

    headers['Content-Length'] = st.size;
    headers['Accept-Ranges'] = 'bytes';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function notFound(res, msg = '未找到') {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    `<!doctype html><meta charset="utf-8"><title>404</title>` +
      `<body style="margin:0;height:100vh;display:grid;place-items:center;background:#1b201a;color:#e8e2d4;` +
      `font:15px/1.7 'Songti SC',serif"><div style="text-align:center">` +
      `<div style="font-size:38px;letter-spacing:.4em;opacity:.5">空</div>` +
      `<p>${msg}</p><p><a href="/" style="color:#c9a227">回到山门</a></p></div></body>`
  );
}

/* --------------------------------------------------------------- 代理 */

function proxyApi(req, res) {
  const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
  delete headers['accept-encoding']; // 让后端返回未压缩内容，转发更简单

  const up = http.request(
    { host: API_HOST, port: API_PORT, method: req.method, path: req.url, headers, timeout: API_TIMEOUT },
    (r) => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    }
  );

  up.on('timeout', () => up.destroy(new Error('upstream timeout')));
  up.on('error', (e) => {
    if (res.headersSent) return res.end();
    log('API 代理失败', e.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: '后端未就绪', detail: e.message }));
  });

  req.pipe(up);
}

/**
 * WebSocket 升级：把原始 Upgrade 请求原样透传给 FastAPI，之后双向管道。
 * @param {http.IncomingMessage} req
 * @param {net.Socket} socket
 * @param {Buffer} head
 */
function proxyUpgrade(req, socket, head) {
  const upstream = net.connect(API_PORT, API_HOST);

  upstream.on('connect', () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const k = req.rawHeaders[i];
      const v = req.rawHeaders[i + 1];
      lines.push(`${k}: ${k.toLowerCase() === 'host' ? `${API_HOST}:${API_PORT}` : v}`);
    }
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on('error', (e) => {
    log('WS 代理失败', e.message);
    socket.destroy();
  });
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy());
}

/* ----------------------------------------------------------- 落地页 */

const LANDING = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>山寺 · 静坐片刻</title>
<style>
  :root{--ink:#1b201a;--paper:#e9e3d4;--muted:rgba(233,227,212,.56);--gold:#c9a227;--line:rgba(233,227,212,.16)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;background:radial-gradient(120% 80% at 50% 0%,#2a3229 0%,#171c17 55%,#10130f 100%);
    color:var(--paper);font:15px/1.75 "Songti SC","Noto Serif CJK SC",serif;
    display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6vh 22px}
  .seal{width:56px;height:56px;border:1px solid var(--gold);border-radius:6px;display:grid;place-items:center;
    color:var(--gold);font-size:15px;letter-spacing:.18em;line-height:1.1;text-align:center;opacity:.85}
  h1{margin:26px 0 6px;font-size:34px;font-weight:500;letter-spacing:.42em;text-indent:.42em}
  .sub{color:var(--muted);letter-spacing:.22em;font-size:12.5px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;width:100%;max-width:760px;margin-top:44px}
  a.card{display:block;padding:22px 22px 20px;border:1px solid var(--line);border-radius:3px;
    background:rgba(233,227,212,.03);text-decoration:none;color:inherit;transition:.28s ease}
  a.card:hover{background:rgba(233,227,212,.07);border-color:rgba(201,162,39,.45);transform:translateY(-2px)}
  .card .no{font-size:10.5px;letter-spacing:.24em;color:var(--gold);opacity:.8}
  .card h2{margin:10px 0 6px;font-size:19px;font-weight:500;letter-spacing:.1em}
  .card p{font-size:12.5px;color:var(--muted);letter-spacing:.04em}
  .card .go{margin-top:14px;font-size:11.5px;color:var(--gold);letter-spacing:.16em;opacity:.75}
  .status{margin-top:38px;font-size:11.5px;letter-spacing:.12em;color:var(--muted);
    display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
  .status i{font-style:normal;color:var(--gold)}
  footer{margin-top:30px;font-size:11px;color:rgba(233,227,212,.3);letter-spacing:.2em}
</style>
</head>
<body>
  <div class="seal">山<br>寺</div>
  <h1>山寺</h1>
  <div class="sub">不言不语 · 一起坐着</div>

  <div class="cards">
    <a class="card" href="/proto/">
      <div class="no">01 / PROTOTYPE</div>
      <h2>零构建原型</h2>
      <p>静态三文件，改动即刷新。适合调场景与镜头。</p>
      <div class="go">进入 →</div>
    </a>
    <a class="card" href="/app/">
      <div class="no">02 / UNI-APP</div>
      <h2>H5 正式版</h2>
      <p>uni-app 构建产物，可继续打包小程序与 App。</p>
      <div class="go">进入 →</div>
    </a>
    <a class="card" href="/api/health">
      <div class="no">03 / API</div>
      <h2>后端接口</h2>
      <p>FastAPI：房间、愿灯、功德、搬瓦、供养。</p>
      <div class="go">查看 health →</div>
    </a>
  </div>

  <div class="status">
    <span>端口 <i>${PORT}</i></span>
    <span>后端 <i id="api">检测中…</i></span>
    <span>房间 <i id="rooms">—</i></span>
    <span>在场 <i id="online">—</i></span>
  </div>
  <footer>SANSA TEMPLE · SINGLE PORT GATEWAY</footer>

<script>
  fetch('/api/health').then(r => r.json()).then(d => {
    document.getElementById('api').textContent = d.ok ? '在线' : '异常';
    document.getElementById('rooms').textContent = d.rooms ?? '—';
    // online 是按房间聚合的对象，这里取合计
    const o = d.online;
    const n = (o && typeof o === 'object') ? Object.values(o).reduce((a, b) => a + (Number(b) || 0), 0) : (o ?? 0);
    document.getElementById('online').textContent = n;
  }).catch(() => { document.getElementById('api').textContent = '离线'; });
</script>
</body>
</html>`;

/* --------------------------------------------------------- 请求分发 */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = decodeURIComponent(url.pathname);

  // 后端 REST
  if (p === '/api' || p.startsWith('/api/')) return proxyApi(req, res);

  // 网关自身探活
  if (p === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, port: PORT, upstream: `${API_HOST}:${API_PORT}` }));
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  // 落地页
  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(LANDING);
  }

  // 静态原型
  if (p === '/proto' || p.startsWith('/proto/')) {
    const rel = p.slice('/proto'.length) || '/';
    if (rel === '/' || rel === '') return sendFile(req, res, path.join(PROTO_DIR, 'index.html'));
    const file = safeJoin(PROTO_DIR, rel);
    if (!file) return notFound(res, '路径不合法');
    return sendFile(req, res, file);
  }

  // uni-app H5
  if (p === '/app' || p.startsWith('/app/')) {
    const rel = p.slice('/app'.length) || '/';
    if (rel === '/' || rel === '') return sendFile(req, res, path.join(UNI_DIR, 'index.html'));
    const file = safeJoin(UNI_DIR, rel);
    if (!file) return notFound(res, '路径不合法');
    return sendFile(req, res, file);
  }

  // 产物内的绝对资源路径
  if (p.startsWith('/assets/') || p.startsWith('/static/')) {
    const file = safeJoin(UNI_DIR, p);
    if (!file) return notFound(res, '路径不合法');
    return sendFile(req, res, file);
  }

  // 常见静态探测文件
  if (p === '/favicon.ico' || p === '/robots.txt' || p === '/manifest.webmanifest') {
    const file = safeJoin(UNI_DIR, p);
    if (file && fs.existsSync(file)) return sendFile(req, res, file);
    res.writeHead(204);
    return res.end();
  }

  return notFound(res, '这一页不存在');
});

server.on('upgrade', (req, socket, head) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p.startsWith('/ws/')) return proxyUpgrade(req, socket, head);
  socket.destroy();
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, BIND, () => {
  log(`山寺网关已启动  http://${BIND}:${PORT}`);
  log(`静态原型        /proto/`);
  log(`uni-app H5      /app/`);
  log(`REST 代理       /api/*   → ${API_HOST}:${API_PORT}`);
  log(`WS   代理       /ws/*    → ${API_HOST}:${API_PORT}`);
});

const shutdown = (sig) => {
  log(`收到 ${sig}，正在关闭`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
