"""WebSocket 在场同步的端到端自检。

用法：先启动 uvicorn（8000），再执行 python scripts/ws_check.py
"""
import asyncio
import json

import websockets

URL = "ws://127.0.0.1:8000/ws/presence?room=02&name="


async def wait_for(ws, kind, timeout=4):
    """读到指定类型的消息为止，忽略中间的系统广播（如 count）。"""
    while True:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout))
        if msg.get("t") == kind:
            return msg


async def main() -> None:
    async with websockets.connect(URL + "A") as a:
        welcome = json.loads(await a.recv())
        print("A welcome:", welcome)
        assert welcome["t"] == "welcome"

        async with websockets.connect(URL + "B") as b:
            wb = json.loads(await b.recv())
            print("B welcome:", wb)
            assert wb["t"] == "welcome"
            assert len(wb["players"]) == 2, wb

            # A 应收到 B 的 join
            join = await wait_for(a, "join")
            print("A got:", join)

            # B 移动，A 应收到 move
            await b.send(json.dumps({"t": "move", "x": 1.5, "z": -2.0, "ry": 0.8}))
            move = await wait_for(a, "move")
            print("A got:", move)
            assert move["t"] == "move" and abs(move["x"] - 1.5) < 1e-6

            # B 做动作
            await b.send(json.dumps({"t": "act", "a": "bow"}))
            act = await wait_for(a, "act")
            print("A got:", act)
            assert act["t"] == "act" and act["a"] == "bow"

            # 非法消息
            await b.send("not-json")
            err = await wait_for(b, "error")
            print("B got:", err)

        # B 断开后 A 收到 left
        left = await wait_for(a, "left")
        print("A got:", left)
        assert left["t"] == "left"

    print("\nOK · 在场协议自检通过")


asyncio.run(main())
