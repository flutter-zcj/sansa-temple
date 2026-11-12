# 山寺 · 单端口部署

把三个独立产物收进**一个对外端口**。内部只有一个上游（FastAPI），其余全是静态文件，不引入 nginx、Redis 或第三方依赖。

## 一、拓扑

```
                    对外唯一端口（默认 8080）
                              │
                    ┌─────────▼──────────┐
                    │  deploy/sandbox/   │
                    │  server.js  网关    │
                    └──┬──────┬──────┬───┘
                       │      │      │
        ┌──────────────┘      │      └──────────────┐
        │                     │                     │
   /proto/*              /api/*  /ws/*          /app/*  /assets/*  /static/*
        │                     │                     │
  prototype/            127.0.0.1:8000        web/dist/build/h5/
  （免构建原型）         FastAPI + SQLite      （uni-app H5 产物）
```

关键点：**8000 只绑回环**，外部只能看到 8080。`/ws/presence` 由网关做原始 HTTP Upgrade 透传，不经过额外的 WS 库。

## 二、路由表

| 路径 | 去向 | 说明 |
|---|---|---|
| `/` | 内联落地页 | 三入口导航 + 后端状态实时探测 |
| `/healthz` | 网关自身 | `{"ok":true,"port":8080}` |
| `/proto/` | `prototype/` | 相对路径引用，改动即刷新 |
| `/app/` | `web/dist/build/h5/` | uni-app H5 入口 |
| `/assets/*`、`/static/*` | 同上 | 产物内是绝对路径引用，需单独映射 |
| `/api/*` | `127.0.0.1:8000` | REST 反向代理 |
| `/ws/*` | `127.0.0.1:8000` | WebSocket 透传 |

## 三、启动

```bash
# 前台（Ctrl-C 一起退出）
./deploy/sandbox/start.sh

# 后台
./deploy/sandbox/start.sh -d
./deploy/sandbox/stop.sh

# 换端口
PORT=9000 API_PORT=8001 ./deploy/sandbox/start.sh
```

托管平台（只注入一个 `PORT`、只跑一条命令）用另一个入口：

```bash
bash deploy/sandbox/serve.sh
```

`serve.sh` 会先拉起 uvicorn 并等 `/api/health` 返回，再 `exec` 网关，避免首屏 API 502。

## 四、环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `PORT` | `8080` | 对外端口，托管平台会注入 |
| `BIND` | `0.0.0.0` | 网关监听地址 |
| `API_HOST` | `127.0.0.1` | 上游地址 |
| `API_PORT` | `8000` | 上游端口 |
| `API_TIMEOUT` | `30000` | 代理超时（毫秒） |

## 五、验证

```bash
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/api/health
curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/app/
```

WebSocket 走网关的自检（需要 `websockets`）：

```bash
python3 /tmp/ws_gw_check.py    # 见验证记录；连的是 8080 而非 8000
```

关键现象：两个客户端依次 `welcome` → `join` → `move` → `act` → `left` 全部收到，说明 Upgrade 透传与双向管道正常。

## 六、注意事项

**1. 前端必须同源。** 之前前端写死 `ws://hostname:8000`，单端口下会连不上。已改为 `location.host`：

- `prototype/src/main.js` — `${proto}://${location.host}/ws/presence`
- `web/src/pages/temple/scene/stage.js` — `opt.wsHost || location.host`

uni-app 改动后必须重新 `npm run build:h5`，产物才会生效；原型改动刷新即可。

**2. 托管平台的访问凭据在链接里。** 分享链接形如 `https://xxx/?sharecode=ABC`，首屏请求会种 cookie，之后 `/app/`、`/proto/` 靠 cookie 放行。**直接访问 `/app/` 而不带 `sharecode` 会被 403**，这是平台行为，不是网关问题。发给别人时整条链接原样给，不要截断。

**3. 产物体积 41MB。** 主要是贴图与 Three.js。静态资源带 `ETag` 弱校验与 `Cache-Control: max-age=3600`，`index.html` 走 `no-cache`，改版后不会读到旧壳。网关支持单区间 `Range`，3D 资源与音频可断点加载。

**4. 路径穿越已拦截。** 所有静态请求都过 `safeJoin()`，`..` 逃逸返回 404，不会读到项目外的文件。

**5. 没有守护进程。** 进程挂了不会自愈。生产环境建议交给 systemd 或 PM2：

```ini
# /etc/systemd/system/sansa.service
[Unit]
Description=Sansa Temple Gateway
After=network.target

[Service]
WorkingDirectory=/path/to/sansa
ExecStart=/usr/bin/bash deploy/sandbox/serve.sh
Restart=always
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
```
