"""
City Tick 引擎
后端 asyncio 定时任务，驱动 GT 时间流逝并通过 WebSocket 推送结算结果。
"""

from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING

from app.engine.calculator import Calculator

if TYPE_CHECKING:
    from app.api.websocket import ConnectionManager
    from app.services.session_manager import SessionManager


class TickEngine:
    """
    全局 Tick 引擎。
    每 TICK_INTERVAL 秒执行一次，遍历所有在线且 gt_running 的玩家，
    调用 Calculator.tick() 结算属性变化，通过 WebSocket 推送最新状态。
    """

    # 每 2 秒 = 1 GT 分钟（与前端原始设定一致）
    TICK_INTERVAL: float = 2.0

    def __init__(self, ws_manager: "ConnectionManager", session_mgr: "SessionManager"):
        self._ws_manager = ws_manager
        self._session_mgr = session_mgr
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self):
        """启动 Tick 循环。"""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        print("⏱️  Tick 引擎已启动")

    async def stop(self):
        """停止 Tick 循环。"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        print("⏱️  Tick 引擎已停止")

    async def _loop(self):
        """主循环：每 TICK_INTERVAL 秒执行一次全局结算。"""
        while self._running:
            try:
                await self._tick_all()
            except Exception as e:
                print(f"⚠️  Tick 引擎异常：{e}")
            await asyncio.sleep(self.TICK_INTERVAL)

    async def _tick_all(self):
        """遍历所有在线玩家，执行 Tick 结算并推送。"""
        online_players = self._session_mgr.get_online_player_ids()

        for player_id in online_players:
            session = self._session_mgr.get_session(player_id)
            if session is None or not session.gt_running:
                continue

            # 执行结算
            new_session, events = Calculator.tick(session)
            self._session_mgr.update_session(player_id, new_session)

            # 推送状态更新
            await self._ws_manager.send_to_player(player_id, {
                "type": "state_update",
                "data": {
                    "player": new_session.player.to_dict(),
                    "gt_time": new_session.gt_time,
                    "current_location": new_session.current_location,
                    "food_supply": new_session.food_supply,
                    "inventory": new_session.inventory,
                },
            })

            # 推送事件（昏迷等）
            for event in events:
                await self._ws_manager.send_to_player(player_id, {
                    "type": "narrative_event",
                    "data": event,
                })
