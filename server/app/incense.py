"""山寺 · 上香排队。

设计取舍：
    队列放在进程内存，不落 SQLite。上香是"人和香同时在场"的瞬时状态，
    进程重启后连接全断、人也离开，落库只会留下无法唤醒的僵尸队列。
    需要多实例时，把 rooms 换成 Redis List（LPUSH / LINDEX / LREM），
    语义与这里一致。

计时规则：
    队首 started_at 为空时，第一次被查询即开始计时（"香已点着"）；
    满 INCENSE_HOLD 秒自动出队，下一位从当前时刻重新计时。
    所有状态都在 _prune() 里惰性推进，不需要后台定时任务。
"""
from __future__ import annotations

import secrets
import time
from dataclasses import dataclass

from .config import INCENSE_HOLD


@dataclass
class Entry:
    token: str
    name: str
    joined_at: float
    started_at: float | None = None


class IncenseQueue:
    """每个房间一条队列，队首即正在上香的人。"""

    def __init__(self, hold: int = INCENSE_HOLD) -> None:
        self.hold = hold
        self.rooms: dict[str, list[Entry]] = {}

    # ------------------------------------------------------------ 内部

    def _prune(self, room: str) -> list[Entry]:
        """推进计时：队首起表、超时出队。返回清理后的队列。"""
        now = time.time()
        q = self.rooms.setdefault(room, [])
        while q:
            head = q[0]
            if head.started_at is None:
                head.started_at = now
            if now - head.started_at >= self.hold:
                q.pop(0)
                if q:
                    q[0].started_at = now  # 下一位接手
                continue
            break
        return q

    # ------------------------------------------------------------ 查询

    def status(self, room: str, token: str | None = None) -> dict:
        q = self._prune(room)
        now = time.time()

        current = None
        if q:
            remain = max(0, int(round(self.hold - (now - (q[0].started_at or now)))))
            current = {"name": q[0].name, "remain": remain}

        ahead = current["remain"] if current else 0
        queue = [
            {"name": e.name, "wait": ahead + (i - 1) * self.hold}
            for i, e in enumerate(q[1:], start=1)
        ]

        # 带上 token 查询时，一并算出"我在哪"，省一次往返
        mine = None
        if token:
            for i, e in enumerate(q):
                if e.token == token:
                    mine = {
                        "name": e.name,
                        "position": i + 1,
                        "wait": 0 if i == 0 else ahead + (i - 1) * self.hold,
                    }
                    break

        return {
            "room": room,
            "hold": self.hold,
            "current": current,
            "queue": queue,
            "size": len(q),
            "mine": mine,
        }

    # ------------------------------------------------------------ 变更

    def join(self, room: str, name: str) -> tuple[str, dict]:
        """入队，返回 (token, 状态)。token 用于离队与找回自己的位置。"""
        q = self._prune(room)
        token = secrets.token_hex(6)
        q.append(Entry(token=token, name=(name or "访客")[:24], joined_at=time.time()))

        st = self.status(room)
        idx = next(i for i, e in enumerate(q) if e.token == token)
        ahead = st["current"]["remain"] if st["current"] else 0
        wait = 0 if idx == 0 else ahead + (idx - 1) * self.hold
        return token, {
            **st,
            "position": idx + 1,
            "wait": wait,
            # 让前端一次拿到"我在哪"，不必再补一次查询
            "mine": {"name": q[-1].name, "position": idx + 1, "wait": wait},
        }

    def leave(self, room: str, token: str) -> bool:
        """主动离队。队首离开时，第二位立即接手。"""
        q = self._prune(room)
        for i, e in enumerate(q):
            if e.token == token:
                q.pop(i)
                if i == 0 and q:
                    q[0].started_at = time.time()
                return True
        return False

    def reset(self, room: str) -> None:
        self.rooms.pop(room, None)


incense = IncenseQueue()
