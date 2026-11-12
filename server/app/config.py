"""山寺 · 服务端配置。

所有可调参数集中在此，便于按部署环境覆盖。
"""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("SANSA_DATA_DIR", BASE_DIR / "data"))
DB_PATH = Path(os.getenv("SANSA_DB", DATA_DIR / "sansa.db"))

HOST = os.getenv("SANSA_HOST", "0.0.0.0")
PORT = int(os.getenv("SANSA_PORT", "8000"))

# 单个房间的在线上限（原站为 20）
ROOM_CAPACITY = int(os.getenv("SANSA_ROOM_CAPACITY", "20"))
# 房间数量：房号从 01 开始
ROOM_COUNT = int(os.getenv("SANSA_ROOM_COUNT", "4"))

# 愿望灯架：钩位数量（前端灯架按 3 层 × 8 钩渲染，索引 0..N-1）
LANTERN_HOOKS = int(os.getenv("SANSA_LANTERN_HOOKS", "24"))

# 上香：每人上香时长（秒），到点自动让给下一位
INCENSE_HOLD = int(os.getenv("SANSA_INCENSE_HOLD", "20"))

# 搬瓦：修一座殿所需瓦数
TILE_GOAL = int(os.getenv("SANSA_TILE_GOAL", "1080"))

# 允许跨域的前端来源，逗号分隔；* 表示全部
CORS_ORIGINS = [o.strip() for o in os.getenv("SANSA_CORS", "*").split(",") if o.strip()]

# 供养信息（可改为环境变量注入）
SUPPORT = {
    "bank": os.getenv("SANSA_BANK", "招商银行 山寺 6225 **** **** 3721"),
    "pay_qr": os.getenv("SANSA_PAY_QR", ""),
    "note": "供养随喜，不拘多少。",
}

DATA_DIR.mkdir(parents=True, exist_ok=True)
