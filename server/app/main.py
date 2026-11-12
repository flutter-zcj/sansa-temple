"""山寺 · FastAPI 应用入口。

启动：
    cd server && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

接口总览：
    GET  /api/health                 健康检查
    GET  /api/rooms                  房间列表（房号 / 在线人数 / 容量）
    GET  /api/rooms/{room}           单房间详情
    GET  /api/lanterns?room=02       已挂的愿望灯
    POST /api/lanterns               挂一盏灯（钩位唯一）
    GET  /api/merit/{key}            查询功德（bow / beads / moktak）
    POST /api/merit/{key}            累加功德
    GET  /api/tiles                  各房间搬瓦进度
    POST /api/tiles                  上报搬瓦
    GET  /api/incense?room=02        上香队列状态
    POST /api/incense                排队上香
    DEL  /api/incense                离队
    GET  /api/support                供养信息
    WS   /ws/presence?room=02&name=  在场同步
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import store
from .config import (
    CORS_ORIGINS,
    INCENSE_HOLD,
    LANTERN_HOOKS,
    ROOM_CAPACITY,
    ROOM_COUNT,
    SUPPORT,
    TILE_GOAL,
)
from .incense import incense
from .ws import RoomFull, presence


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.init_db()
    yield


app = FastAPI(title="山寺 · Sansa Temple API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def room_code(n: int) -> str:
    return f"{n:02d}"


def check_room(room: str) -> str:
    code = room.zfill(2)
    if not code.isdigit() or not (1 <= int(code) <= ROOM_COUNT):
        raise HTTPException(status_code=404, detail="房间不存在")
    return code


# ------------------------------------------------------------------ 基础

@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "rooms": ROOM_COUNT, "online": presence.totals()}


@app.get("/api/rooms")
def rooms() -> dict:
    items = []
    for i in range(1, ROOM_COUNT + 1):
        code = room_code(i)
        n = presence.online(code)
        items.append({
            "room": code,
            "name": f"山寺 {code}",
            "online": n,
            "capacity": ROOM_CAPACITY,
            "status": "full" if n >= ROOM_CAPACITY else ("busy" if n > ROOM_CAPACITY * 0.7 else "open"),
        })
    return {"items": items, "capacity": ROOM_CAPACITY}


@app.get("/api/rooms/{room}")
def room_detail(room: str) -> dict:
    code = check_room(room)
    return {
        "room": code,
        "online": presence.online(code),
        "capacity": ROOM_CAPACITY,
        # REST 无身份上下文，返回全部在场者；过滤自己由 WS welcome 负责
        "players": presence.snapshot(code),
    }


# ------------------------------------------------------------------ 愿望灯

# 灯色：金（祈愿）· 朱（平安）· 青（追思）· 素（无言）
COLORS = ("jin", "zhu", "qing", "bai")


class LanternIn(BaseModel):
    room: str = "02"
    hook: int = Field(ge=0)
    color: str = Field(default="jin", max_length=16)
    wish: str = Field(min_length=1, max_length=40)
    author: str = Field(default="", max_length=24)


def lantern_payload(room: str) -> dict:
    """灯架完整状态：钩位数、已挂的灯、剩余空位。"""
    items = store.list_lanterns(room)
    taken = {it["hook"] for it in items}
    return {
        "room": room,
        "hooks": LANTERN_HOOKS,
        "total": len(items),
        "free": max(0, LANTERN_HOOKS - len(taken)),
        "colors": list(COLORS),
        "items": items,
    }


@app.get("/api/lanterns")
def lanterns(room: str = Query("02")) -> dict:
    return lantern_payload(check_room(room))


@app.post("/api/lanterns", status_code=201)
async def create_lantern(body: LanternIn) -> dict:
    code = check_room(body.room)
    if not 0 <= body.hook < LANTERN_HOOKS:
        raise HTTPException(status_code=422, detail=f"钩位需在 0..{LANTERN_HOOKS - 1} 之间")
    try:
        row = store.add_lantern(code, body.hook, body.color, body.wish.strip(), body.author.strip())
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="这个钩位已经有人先挂了灯")

    # 同室的人立刻看到这盏灯亮起
    await presence.broadcast(code, {
        "t": "lantern",
        "item": row,
        "total": len(store.list_lanterns(code)),
    })
    return row


# ------------------------------------------------------------------ 功德

class MeritIn(BaseModel):
    delta: int = Field(default=1, ge=1, le=1000)


@app.get("/api/merit/{key}")
def merit(key: str) -> dict:
    return {"key": key, "value": store.get_merit(key)}


@app.post("/api/merit/{key}")
def add_merit(key: str, body: MeritIn) -> dict:
    value = store.add_merit(key, body.delta)
    unlock = value >= 25 if key == "bow" else None
    return {"key": key, "value": value, "coffee_unlocked": unlock}


# ------------------------------------------------------------------ 搬瓦

class TileIn(BaseModel):
    room: str = "02"
    delta: int = Field(default=1, ge=1, le=100)


def tile_payload() -> dict:
    rows = store.all_tiles()
    total = sum(r["tiles"] for r in rows)
    return {
        "items": rows,
        "total": total,
        "goal": TILE_GOAL,
        "percent": round(min(1.0, total / TILE_GOAL) * 100, 1) if TILE_GOAL else 0.0,
    }


@app.get("/api/tiles")
def tiles() -> dict:
    return tile_payload()


@app.post("/api/tiles")
async def add_tiles(body: TileIn) -> dict:
    code = check_room(body.room)
    n = store.add_tiles(code, body.delta)
    payload = tile_payload()
    brief = {k: payload[k] for k in ("total", "goal", "percent")}

    await presence.broadcast(code, {"t": "tile", "room": code, "room_tiles": n, **brief})
    return {"room": code, "tiles": n, **brief}


# ------------------------------------------------------------------ 上香

class IncenseIn(BaseModel):
    room: str = "02"
    name: str = Field(default="访客", max_length=24)


@app.get("/api/incense")
def incense_status(room: str = Query("02"), token: str = Query("")) -> dict:
    return incense.status(check_room(room), token or None)


@app.post("/api/incense", status_code=201)
async def incense_join(body: IncenseIn) -> dict:
    code = check_room(body.room)
    token, st = incense.join(code, body.name.strip() or "访客")
    await presence.broadcast(code, {"t": "incense", **incense.status(code)})
    return {"token": token, **st}


@app.delete("/api/incense")
async def incense_leave(room: str = Query("02"), token: str = Query("")) -> dict:
    code = check_room(room)
    left = incense.leave(code, token)
    st = incense.status(code)
    await presence.broadcast(code, {"t": "incense", **st})
    return {"left": left, **st}


# ------------------------------------------------------------------ 供养

@app.get("/api/support")
def support() -> dict:
    return SUPPORT


# ------------------------------------------------------------------ 在场 WS

@app.websocket("/ws/presence")
async def presence_ws(ws: WebSocket, room: str = Query("02"), name: str = Query("")) -> None:
    code = check_room(room)
    await ws.accept()

    try:
        player = await presence.join(code, ws, name[:24])
    except RoomFull:
        await ws.send_json({"t": "error", "code": "full", "message": "这间已满，换一间吧"})
        await ws.close(code=4001)
        return

    await presence.send(player, {
        "t": "welcome",
        "id": player.id,
        "room": code,
        "capacity": ROOM_CAPACITY,
        # welcome 只带别人，避免前端重复生成自己
        "players": [p for p in presence.snapshot(code) if p["id"] != player.id],
    })
    await presence.broadcast(code, {"t": "join", **player.public()}, exclude=player.id)
    await presence.broadcast_count(code)

    last_move = 0.0
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await presence.send(player, {"t": "error", "code": "bad_message", "message": "无法解析的消息"})
                continue

            t = msg.get("t")
            if t == "move":
                player.x = float(msg.get("x", player.x))
                player.z = float(msg.get("z", player.z))
                player.ry = float(msg.get("ry", player.ry))
                await presence.broadcast(
                    code,
                    {"t": "move", "id": player.id, "x": player.x, "z": player.z, "ry": player.ry},
                    exclude=player.id,
                )
            elif t == "act":
                await presence.broadcast(code, {"t": "act", "id": player.id, "a": str(msg.get("a", ""))[:16]}, exclude=player.id)
            elif t == "chat":
                text = str(msg.get("m", "")).strip()[:80]
                if text:
                    await presence.broadcast(code, {"t": "chat", "id": player.id, "name": player.name, "m": text})
            elif t == "hello":
                player.name = str(msg.get("name", player.name))[:24]
                await presence.broadcast(code, {"t": "join", **player.public()}, exclude=player.id)
    except WebSocketDisconnect:
        pass
    finally:
        await presence.leave(player)
        await presence.broadcast(code, {"t": "left", "id": player.id})
        await presence.broadcast_count(code)
