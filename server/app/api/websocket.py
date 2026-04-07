"""
WebSocket 连接管理与指令解析。
前端通过 WebSocket 发送 JSON 指令，后端解析执行并推送状态。
"""

from __future__ import annotations

import json
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.engine.calculator import Calculator, GameSession
from app.services.session_manager import SessionManager, LOCATIONS

router = APIRouter()


class ConnectionManager:
    """管理所有在线玩家的 WebSocket 连接"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, player_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[player_id] = websocket

    def disconnect(self, player_id: str):
        self.active_connections.pop(player_id, None)

    async def send_to_player(self, player_id: str, message: dict):
        ws = self.active_connections.get(player_id)
        if ws:
            await ws.send_text(json.dumps(message, ensure_ascii=False))

    async def broadcast(self, message: dict):
        for ws in self.active_connections.values():
            await ws.send_text(json.dumps(message, ensure_ascii=False))

    def is_online(self, player_id: str) -> bool:
        return player_id in self.active_connections


# ─── 全局单例 ────────────────────────────────────────────────────────
manager = ConnectionManager()
session_mgr = SessionManager()


# ─── 指令处理器 ──────────────────────────────────────────────────────
INTRO_LINES = [
    "欢迎来到边境站。",
    "各位已通过入境审查，获得临时居留许可。每人将领取安置资金两千元整。",
    "现在进行户口登记。请依次进入生物特征采集舱。系统需录入各位的外貌特征与行为倾向数据。",
    "该界面将持续显示直至完成确认。录入的性格倾向数据将用于社会保障评级，外貌特征将关联至市内监控系统。",
    "登记完成后，请沿指示标识前往轨道交通站台。列车将统一运送至世界公寓，该处为各位的初始安置点。公寓配备基础生活设施，具体单元号于抵达后分配。",
    "两千元安置资金请于激活后合理规划使用。城内基础消费标准较高，建议尽快办理就业登记。",
    "登记程序现在开始。",
]


async def handle_command(player_id: str, payload: dict):
    """
    处理前端发来的指令。
    payload 格式: { "action": "xxx", ... }
    """
    action = payload.get("action", "")
    session = session_mgr.get_session(player_id)

    # ── 连接初始化：发送完整状态 ──
    if action == "init":
        if session is None:
            session = session_mgr.create_session(player_id)
        await send_full_state(player_id, session)
        return

    # ── 推进 Intro ──
    if action == "advance_intro":
        if session is None:
            return
        new_index = session.intro_index + 1
        if new_index >= len(INTRO_LINES):
            session.phase = "character_creation"
        else:
            session.intro_index = new_index
        session_mgr.update_session(player_id, session)
        await send_full_state(player_id, session)
        return

    # ── 角色创建 ──
    if action == "set_gender":
        if session is None:
            return
        session.player.gender = payload.get("gender", "男")
        session_mgr.update_session(player_id, session)
        await send_full_state(player_id, session)
        return

    if action == "set_skills":
        if session is None:
            return
        session.player.skills = payload.get("skills", session.player.skills)
        session_mgr.update_session(player_id, session)
        await send_full_state(player_id, session)
        return

    if action == "finish_creation":
        if session is None:
            return
        session.player.name = payload.get("name", "新移民")
        session.phase = "transit"
        session_mgr.update_session(player_id, session)
        await send_full_state(player_id, session)
        return

    # ── 完成过渡动画，进入 gameplay ──
    if action == "finish_transit":
        if session is None:
            return
        session.phase = "gameplay"
        session.gt_running = True
        session_mgr.update_session(player_id, session)
        await send_full_state(player_id, session)
        # 发送初始场景描述
        loc = LOCATIONS.get(session.current_location, {})
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {"type": "system", "text": "你已抵达世界公寓。系统分配了一间位于 7 楼的单元。"},
        })
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {
                "type": "scene",
                "text": loc.get("description", ""),
                "location_name": loc.get("name", ""),
                "actions": loc.get("actions", []),
            },
        })
        return

    # ── Gameplay 指令 ──
    if session is None or session.phase != "gameplay":
        await manager.send_to_player(player_id, {
            "type": "error", "data": {"text": "当前阶段无法执行此指令。"}
        })
        return

    if action == "goto":
        target_id = payload.get("target", "")
        new_session, events = Calculator.move(session, target_id, LOCATIONS)
        # 附加目标地点的 actions 到场景事件
        target_loc = LOCATIONS.get(target_id, {})
        for evt in events:
            if evt.get("type") == "scene":
                evt["actions"] = target_loc.get("actions", [])
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        for event in events:
            await manager.send_to_player(player_id, {
                "type": "narrative_event", "data": event,
            })
        return

    if action == "eat":
        if session.current_location != "apartment_kitchen":
            await manager.send_to_player(player_id, {
                "type": "narrative_event",
                "data": {"type": "system", "text": "你需要在厨房才能吃东西。"},
            })
            return
        new_session, events = Calculator.eat(session)
        # 附加当前地点的 actions
        loc = LOCATIONS.get(new_session.current_location, {})
        for evt in events:
            evt["actions"] = loc.get("actions", [])
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        for event in events:
            await manager.send_to_player(player_id, {
                "type": "narrative_event", "data": event,
            })
        return

    if action == "buy":
        item_id = payload.get("item", "")
        if item_id == "water":
            if session.current_location != "convenience_store":
                await manager.send_to_player(player_id, {
                    "type": "narrative_event",
                    "data": {"type": "system", "text": "你需要在便利店才能购物。"},
                })
                return
            new_session, events = Calculator.buy_water(session)
            loc = LOCATIONS.get(new_session.current_location, {})
            for evt in events:
                evt["actions"] = loc.get("actions", [])
            session_mgr.update_session(player_id, new_session)
            await send_full_state(player_id, new_session)
            for event in events:
                await manager.send_to_player(player_id, {
                    "type": "narrative_event", "data": event,
                })
        return

    if action == "drink_water":
        new_session, events = Calculator.drink_water(session)
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        for event in events:
            await manager.send_to_player(player_id, {
                "type": "narrative_event", "data": event,
            })
        return

    if action == "look":
        loc = LOCATIONS.get(session.current_location, {})
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {
                "type": "scene",
                "text": loc.get("description", ""),
                "location_name": loc.get("name", ""),
                "actions": loc.get("actions", []),
            },
        })
        return

    if action == "inventory":
        items = session.inventory
        if items:
            text = "、".join(f"{i['name']} x{i['quantity']}" for i in items)
        else:
            text = "空空如也"
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {"type": "system", "text": f"【背包】{text}"},
        })
        return

    if action == "interact":
        target = payload.get("target", "")
        interact_action = payload.get("interact_action", "")
        if target == "sofa":
            if interact_action == "sit":
                text = "你坐在沙发上。弹簧有些塌陷，但比站着舒服多了。窗外传来远处的汽车喇叭声和隐约的人声喧嚣。"
            elif interact_action == "lie":
                text = "你躺在沙发上。天花板上有一道细长的裂缝，从灯座延伸到墙角。你盯着它看了一会儿，思绪逐渐放空。"
            else:
                text = f"你不知道怎么对沙发做\u201c{interact_action}\u201d。"
            await manager.send_to_player(player_id, {
                "type": "narrative_event",
                "data": {"type": "scene", "text": text},
            })
            return

    # 未知指令
    await manager.send_to_player(player_id, {
        "type": "narrative_event",
        "data": {"type": "system", "text": f"未知指令：{action}"},
    })


async def send_full_state(player_id: str, session: GameSession):
    """向玩家推送完整游戏状态。"""
    loc = LOCATIONS.get(session.current_location, {})
    await manager.send_to_player(player_id, {
        "type": "state_update",
        "data": {
            "phase": session.phase,
            "intro_index": session.intro_index,
            "intro_lines": INTRO_LINES,
            "player": session.player.to_dict(),
            "gt_time": session.gt_time,
            "gt_running": session.gt_running,
            "current_location": session.current_location,
            "location": loc,
            "food_supply": session.food_supply,
            "inventory": session.inventory,
        },
    })


# ─── WebSocket 路由 ──────────────────────────────────────────────────
@router.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    """
    WebSocket 连接入口。
    前端发送 JSON 指令，后端解析执行并推送状态。
    """
    await manager.connect(player_id, websocket)

    # 发送连接确认
    await manager.send_to_player(player_id, {
        "type": "connected",
        "data": {"player_id": player_id, "message": f"连接成功，玩家 ID：{player_id}"},
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_to_player(player_id, {
                    "type": "error",
                    "data": {"text": "无效的 JSON 格式"},
                })
                continue

            await handle_command(player_id, payload)

    except WebSocketDisconnect:
        manager.disconnect(player_id)
        session_mgr.remove_session(player_id)
