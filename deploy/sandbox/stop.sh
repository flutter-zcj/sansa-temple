#!/usr/bin/env bash
# 山寺 · 停止全部服务

set -uo pipefail

for f in /tmp/sansa-gw.pid /tmp/sansa-api.pid; do
  if [[ -f "$f" ]]; then
    pid="$(cat "$f")"
    kill "$pid" 2>/dev/null && echo "已停止 PID $pid" || true
    rm -f "$f"
  fi
done

pkill -f "node .*deploy/sandbox/server.js" 2>/dev/null && echo "已停止网关" || true
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "已停止后端" || true
pkill -f "http.server 5180" 2>/dev/null || true
pkill -f "http.server 5190" 2>/dev/null || true

echo "清理完成"
