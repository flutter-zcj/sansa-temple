"""山寺 · 在场同步（WebSocket）。

协议（JSON 文本帧，单条消息一个对象）：

客户端 → 服务端
    {"t":"hello","name":"访客"}                     可选，入房后补报昵称
    {"t":"move","x":1.2,"z":-3.4,"ry":0.7}          位置与朝向，建议 10Hz
    {"t":"act","a":"bow|pray|moktak|beads|sit"}      动作广播
    {"t":"chat","m":"..."}                           一句话（可选）

服务端 → 客户端
    {"t":"welcome","id":"..","room":"02","capacity":20,"players":[...]}
    {"t":"join","id":"..","name":"..","x":0,"z":0,"ry":0}
    {"t":"left","id":".."}
    {"t":"move","id":"..","x":0,"z":0,"ry":0}
    {"t":"act","id":"..","a":"bow"}
    {"t":"chat","id":"..","name":"..","m":"..."}
    {"t":"count","n":3}
    {"t":"error","code":"full|bad_message","message":".."}

服务端只做转发与人数控制，不裁决位置合法性（客户端已有边界与碰撞）。
"""
from __future__ import annotations

import asyncio
import secrets
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

from .config import ROOM_CAPACITY


@dataclass
class Player:
    id: str
    name: str
    room: str
    x: float = 0.0
    z: float = 34.0
    ry: float = 3.14
    ws: WebSocket | None = field(default=None, repr=False)

    def public(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "x": self.x, "z": self.z, "ry": self.ry}


class RoomFull(Exception):
    pass


class Presence:
    """单进程内存在场管理。多实例部署时把 broadcast 换成 Redis pub/sub。"""

    def __init__(self) -> None:
        self.rooms: dict[str, dict[str, Player]] = {}
        self._lock = asyncio.Lock()

    async def join(self, room: str, ws: WebSocket, name: str = "") -> Player:
        async with self._lock:
            players = self.rooms.setdefault(room, {})
            if len(players) >= ROOM_CAPACITY:
                raise RoomFull(room)
            pid = secrets.token_hex(4)
            player = Player(id=pid, name=name or f"访客-{pid[:4]}", room=room, ws=ws)
            players[pid] = player
            return player

    async def leave(self, player: Player) -> None:
        async with self._lock:
            self.rooms.get(player.room, {}).pop(player.id, None)

    def snapshot(self, room: str) -> list[dict]:
        return [p.public() for p in self.rooms.get(room, {}).values()]

    def online(self, room: str) -> int:
        return len(self.rooms.get(room, {}))

    async def send(self, player: Player, payload: dict) -> None:
        if player.ws is None:
            return
        try:
            await player.ws.send_json(payload)
        except Exception:
            # 连接已断，交给 finally 清理
            pass

    async def broadcast(self, room: str, payload: dict, exclude: str | None = None) -> None:
        targets = [p for p in self.rooms.get(room, {}).values() if p.id != exclude]
        if not targets:
            return
        await asyncio.gather(*(self.send(p, payload) for p in targets), return_exceptions=True)

    async def broadcast_count(self, room: str) -> None:
        await self.broadcast(room, {"t": "count", "n": self.online(room)})

    def totals(self) -> dict[str, int]:
        return {room: len(ps) for room, ps in self.rooms.items()}


presence = Presence()
