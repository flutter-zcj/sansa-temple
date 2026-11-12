#!/usr/bin/env bash
# 山寺 · 单端口发布入口
#
# 供托管平台使用：平台只注入一个 PORT，本脚本在内部拉起 FastAPI 上游
# （固定 127.0.0.1:8000，不对外），再让网关监听 $PORT。
#
#   PORT=8080 ./deploy/sandbox/serve.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PORT="${PORT:-8080}"
export API_PORT="${API_PORT:-8000}"
export BIND="${BIND:-0.0.0.0}"

echo "[serve] PORT=${PORT} API_PORT=${API_PORT}"

# 上游：只绑本机回环，外部无法直连 8000
( cd "$ROOT/server" && exec python3 -m uvicorn app.main:app \
    --host 127.0.0.1 --port "$API_PORT" --log-level warning ) &

# 等后端可用再放行网关，避免首屏 API 502
for _ in $(seq 1 40); do
  curl -sf --max-time 1 "http://127.0.0.1:${API_PORT}/api/health" > /dev/null && break
  sleep 0.25
done

exec node "$ROOT/deploy/sandbox/server.js"
