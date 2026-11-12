"""山寺 · 持久化层（SQLite）。

选择 SQLite 的原因：单文件、零运维、足够承载"房间 + 愿望灯 + 功德"这类低频写。
后续要横向扩容时，把本文件替换为 PostgreSQL 实现即可，接口保持不变。
"""
from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone
from typing import Iterable

from .config import DB_PATH

_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    """建表（幂等）。"""
    with _lock, _conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS lanterns (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                room      TEXT    NOT NULL,
                hook      INTEGER NOT NULL,
                color     TEXT    NOT NULL,
                wish      TEXT    NOT NULL,
                author    TEXT    NOT NULL DEFAULT '',
                created_at TEXT   NOT NULL,
                UNIQUE(room, hook)
            );
            CREATE TABLE IF NOT EXISTS merit (
                key   TEXT PRIMARY KEY,
                value INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS tile_progress (
                room  TEXT PRIMARY KEY,
                tiles INTEGER NOT NULL DEFAULT 0
            );
            """
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------- 愿望灯

def list_lanterns(room: str) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, hook, color, wish, author, created_at FROM lanterns WHERE room=? ORDER BY hook",
            (room,),
        ).fetchall()
    return [dict(r) for r in rows]


def add_lantern(room: str, hook: int, color: str, wish: str, author: str) -> dict:
    """挂一盏灯；同一钩位已被占用时抛 sqlite3.IntegrityError。"""
    with _lock, _conn() as conn:
        cur = conn.execute(
            "INSERT INTO lanterns(room, hook, color, wish, author, created_at) VALUES(?,?,?,?,?,?)",
            (room, hook, color, wish, author, _now()),
        )
        row = conn.execute(
            "SELECT id, hook, color, wish, author, created_at FROM lanterns WHERE id=?",
            (cur.lastrowid,),
        ).fetchone()
    return dict(row)


def taken_hooks(room: str) -> set[int]:
    with _conn() as conn:
        rows = conn.execute("SELECT hook FROM lanterns WHERE room=?", (room,)).fetchall()
    return {r["hook"] for r in rows}


# ---------------------------------------------------------------- 功德

def get_merit(key: str) -> int:
    with _conn() as conn:
        row = conn.execute("SELECT value FROM merit WHERE key=?", (key,)).fetchone()
    return int(row["value"]) if row else 0


def add_merit(key: str, delta: int) -> int:
    with _lock, _conn() as conn:
        conn.execute(
            "INSERT INTO merit(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = value + excluded.value",
            (key, max(0, delta)),
        )
        row = conn.execute("SELECT value FROM merit WHERE key=?", (key,)).fetchone()
    return int(row["value"])


def add_tiles(room: str, delta: int) -> int:
    with _lock, _conn() as conn:
        conn.execute(
            "INSERT INTO tile_progress(room, tiles) VALUES(?, ?) "
            "ON CONFLICT(room) DO UPDATE SET tiles = tiles + excluded.tiles",
            (room, max(0, delta)),
        )
        row = conn.execute("SELECT tiles FROM tile_progress WHERE room=?", (room,)).fetchone()
    return int(row["tiles"])


def all_tiles() -> list[dict]:
    with _conn() as conn:
        rows = conn.execute("SELECT room, tiles FROM tile_progress ORDER BY room").fetchall()
    return [dict(r) for r in rows]
