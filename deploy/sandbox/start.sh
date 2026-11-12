#!/usr/bin/env bash
# 山寺 · 单端口启动脚本
#
#   ./deploy/sandbox/start.sh          前台运行网关，Ctrl-C 一起退出
#   ./deploy/sandbox/start.sh -d       后台运行，日志写入 /tmp/sansa-*.log
#   PORT=9000 ./deploy/sandbox/start.sh
#
# 端口分配：
#   8080  对外唯一端口（网关）
#   8000  仅本机，FastAPI 上游，不对外暴露

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-8080}"
API_PORT="${API_PORT:-8000}"
BIND="${BIND:-0.0.0.0}"
DETACH=0
[[ "${1:-}" == "-d" ]] && DETACH=1

cd "$ROOT"

cleanup() {
  [[ -n "${GW_PID:-}" ]] && kill "$GW_PID" 2>/dev/null || true
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
}

# 端口被占则先清理旧进程
if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  echo "端口 ${PORT} 已被占用，尝试停止旧网关…"
  pkill -f "node .*deploy/sandbox/server.js" 2>/dev/null || true
  sleep 1
fi
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1

echo "→ 启动 FastAPI (127.0.0.1:${API_PORT})"
( cd "$ROOT/server" && exec python3 -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT" ) \
  > /tmp/sansa-api.log 2>&1 &
API_PID=$!

for _ in $(seq 1 30); do
  curl -sf --max-time 1 "http://127.0.0.1:${API_PORT}/api/health" > /dev/null && break
  sleep 0.4
done

if ! curl -sf --max-time 2 "http://127.0.0.1:${API_PORT}/api/health" > /dev/null; then
  echo "✗ 后端启动失败，查看 /tmp/sansa-api.log"
  tail -20 /tmp/sansa-api.log
  exit 1
fi
echo "✓ 后端就绪"

echo "→ 启动网关 (${BIND}:${PORT})"
PORT="$PORT" API_PORT="$API_PORT" BIND="$BIND" node "$ROOT/deploy/sandbox/server.js" \
  > /tmp/sansa-gw.log 2>&1 &
GW_PID=$!

for _ in $(seq 1 20); do
  curl -sf --max-time 1 "http://127.0.0.1:${PORT}/healthz" > /dev/null && break
  sleep 0.3
done

if ! curl -sf --max-time 2 "http://127.0.0.1:${PORT}/healthz" > /dev/null; then
  echo "✗ 网关启动失败，查看 /tmp/sansa-gw.log"
  tail -20 /tmp/sansa-gw.log
  exit 1
fi

echo ""
echo "  山寺已就绪  http://127.0.0.1:${PORT}"
echo "    落地页        /"
echo "    静态原型      /proto/"
echo "    uni-app H5    /app/"
echo "    API           /api/health"
echo ""

if [[ $DETACH -eq 1 ]]; then
  echo "$GW_PID" > /tmp/sansa-gw.pid
  echo "$API_PID" > /tmp/sansa-api.pid
  echo "已后台运行。停止：./deploy/sandbox/stop.sh"
  trap - EXIT INT TERM
else
  trap cleanup EXIT INT TERM
  echo "前台运行中，Ctrl-C 退出"
  wait $GW_PID
fi
