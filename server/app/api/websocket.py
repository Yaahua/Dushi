"""
WebSocket 连接管理与指令解析。
前端通过 WebSocket 发送 JSON 指令，后端解析执行并推送状态。
"""
from __future__ import annotations
import json
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.engine.calculator import Calculator, GameSession
from app.engine.data_loader import get_npcs
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

# ─── 开场白台词 ──────────────────────────────────────────────────────
INTRO_LINES = [
    "欢迎来到边境站。",
    "各位已通过入境审查，获得临时居留许可。每人将领取安置资金两千元整。",
    "现在进行户口登记。请依次进入生物特征采集舱。系统需录入各位的外貌特征与行为倾向数据。",
    "该界面将持续显示直至完成确认。录入的性格倾向数据将用于社会保障评级，外貌特征将关联至市内监控系统。",
    "登记完成后，请沿指示标识前往轨道交通站台。列车将统一运送至世界公寓，该处为各位的初始安置点。公寓配备基础生活设施，具体单元号于抵达后分配。",
    "两千元安置资金请于激活后合理规划使用。城内基础消费标准较高，建议尽快办理就业登记。",
    "登记程序现在开始。",
]

# ─── 帮助文本 ────────────────────────────────────────────────────────
HELP_TEXT = """【可用指令】
移动：goto <地点ID>
查看：look（查看当前地点）
背包：inventory（查看背包）
吃东西：eat（需在厨房）
购买：buy <商品ID>（需在对应地点）
对话：talk <NPC名字>（需在同一地点）
休息：rest（在公寓休息8小时）
休息N小时：rest <小时数>
交房租：pay_rent（需在公寓，找管理员）
状态：status（查看玩家状态）
时间：time（查看当前游戏时间）
地图：map（查看可前往的地点）
帮助：help（显示此帮助）"""


# ─── 辅助函数 ────────────────────────────────────────────────────────

def _attach_actions(events: list, location_id: str):
    """将当前地点的 actions 附加到场景类事件上。"""
    loc = LOCATIONS.get(location_id, {})
    for evt in events:
        if evt.get("type") in ("scene", "system", "dialogue", "warning", "danger"):
            evt.setdefault("actions", loc.get("actions", []))


async def _send_events(player_id: str, events: list, location_id: str):
    """批量发送事件到前端。"""
    _attach_actions(events, location_id)
    for event in events:
        await manager.send_to_player(player_id, {
            "type": "narrative_event", "data": event,
        })


# ─── 指令处理器 ──────────────────────────────────────────────────────

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
        skills = payload.get("skills", {})
        session.player.skills = skills
        session_mgr.update_session(player_id, session)
        await send_full_state(player_id, session)
        return

    if action == "set_name":
        if session is None:
            return
        session.player.name = payload.get("name", "新移民")
        session_mgr.update_session(player_id, session)
        await send_full_state(player_id, session)
        return

    if action == "confirm_character":
        if session is None:
            return
        session.phase = "transit"
        session_mgr.update_session(player_id, session)
        await send_full_state(player_id, session)
        return

    if action == "start_game":
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
            "data": {
                "type": "scene",
                "text": loc.get("description", ""),
                "location_name": loc.get("name", ""),
                "actions": loc.get("actions", []),
            },
        })
        return

    # ── 以下指令需要 gameplay 阶段 ──
    if session is None:
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {"type": "system", "text": "请先初始化游戏（发送 init 指令）。"},
        })
        return

    if session.phase not in ("gameplay",) and action not in (
        "init", "advance_intro", "set_gender", "set_skills", "set_name",
        "confirm_character", "start_game",
    ):
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {"type": "system", "text": "当前阶段无法执行此指令。"},
        })
        return

    # ── 移动 ──
    if action == "goto":
        target_id = payload.get("target", "")
        new_session, events = Calculator.move(session, target_id, LOCATIONS)
        target_loc = LOCATIONS.get(target_id, {})
        for evt in events:
            if evt.get("type") == "scene":
                evt["actions"] = target_loc.get("actions", [])
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        await _send_events(player_id, events, target_id)
        return

    # ── 吃东西 ──
    if action == "eat":
        if session.current_location != "apartment_kitchen":
            await manager.send_to_player(player_id, {
                "type": "narrative_event",
                "data": {"type": "system", "text": "你需要在厨房才能吃东西。"},
            })
            return
        new_session, events = Calculator.eat(session)
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        await _send_events(player_id, events, new_session.current_location)
        return

    # ── 购买（通用）──
    if action == "buy":
        item_id = payload.get("item", "")
        if item_id == "water":
            # 兼容旧逻辑
            if session.current_location not in ("convenience_store",):
                await manager.send_to_player(player_id, {
                    "type": "narrative_event",
                    "data": {"type": "system", "text": "你需要在便利店才能购物。"},
                })
                return
            new_session, events = Calculator.buy_water(session)
        else:
            # 通用购买
            new_session, events = Calculator.buy_item(session, item_id, LOCATIONS)
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        await _send_events(player_id, events, new_session.current_location)
        return

    # ── 喝水 ──
    if action == "drink_water":
        new_session, events = Calculator.drink_water(session)
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        await _send_events(player_id, events, new_session.current_location)
        return

    # ── 查看当前地点（增强版）──
    if action == "look":
        new_session, events = Calculator.look(session, LOCATIONS)
        await _send_events(player_id, events, session.current_location)
        return

    # ── 背包 ──
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

    # ── 玩家状态 ──
    if action == "status":
        p = session.player
        gt_day = session.gt_time // (24 * 60) + 1
        gt_hour = (session.gt_time % (24 * 60)) // 60
        gt_min = session.gt_time % 60
        hunger_pct = int(p.hunger / p.max_hunger * 100)
        stamina_pct = int(p.stamina / p.max_stamina * 100)
        health_pct = int(p.health / p.max_health * 100)
        text = (
            f"【玩家状态】{p.name}（{p.gender}）\n"
            f"生命：{p.health:.0f}/{p.max_health:.0f}（{health_pct}%）\n"
            f"体力：{p.stamina:.0f}/{p.max_stamina:.0f}（{stamina_pct}%）\n"
            f"饥饿：{hunger_pct}%\n"
            f"余额：¥{p.money:.0f}\n"
            f"游戏时间：第{gt_day}天 {gt_hour:02d}:{gt_min:02d}"
        )
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {"type": "system", "text": text},
        })
        return

    # ── 游戏时间 ──
    if action == "time":
        gt_day = session.gt_time // (24 * 60) + 1
        gt_hour = (session.gt_time % (24 * 60)) // 60
        gt_min = session.gt_time % 60
        time_names = {
            range(5, 9): "清晨", range(9, 12): "上午",
            range(12, 14): "正午", range(14, 17): "下午",
            range(17, 20): "傍晚", range(20, 23): "夜晚",
        }
        period = "深夜"
        for r, name in time_names.items():
            if gt_hour in r:
                period = name
                break
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {"type": "system", "text": f"【时间】第{gt_day}天 {gt_hour:02d}:{gt_min:02d}（{period}）"},
        })
        return

    # ── 地图：显示可前往的地点 ──
    if action == "map":
        loc = LOCATIONS.get(session.current_location, {})
        connections = loc.get("connections", [])
        actions = loc.get("actions", [])
        if actions:
            lines = [f"【{loc.get('name', '当前位置')}】可前往："]
            for act in actions:
                lines.append(f"  · {act['label']}  → {act['command']}")
            text = "\n".join(lines)
        elif connections:
            lines = [f"【{loc.get('name', '当前位置')}】可前往："]
            for conn in connections:
                target = conn.get("target", "")
                target_loc = LOCATIONS.get(target, {})
                lines.append(f"  · {target_loc.get('name', target)}  → goto {target}")
            text = "\n".join(lines)
        else:
            text = "你找不到任何可以前往的地方。"
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {"type": "system", "text": text, "actions": actions},
        })
        return

    # ── 与 NPC 对话 ──
    if action == "talk":
        npc_name_or_id = payload.get("target", "")
        topic = payload.get("topic", "greeting")
        npcs = get_npcs()

        # 支持按名字查找 NPC
        npc_id = npc_name_or_id
        if npc_name_or_id not in npcs:
            # 尝试按名字匹配
            for nid, npc_data in npcs.items():
                if npc_data.get("name") == npc_name_or_id:
                    npc_id = nid
                    break

        rels = session_mgr.get_relationships(player_id)
        new_session, events = Calculator.talk_to_npc(session, npc_id, npcs, topic, rels)
        session_mgr.update_session(player_id, new_session)
        await _send_events(player_id, events, session.current_location)
        return

    # ── 休息 ──
    if action == "rest":
        hours = int(payload.get("hours", 8))
        hours = max(1, min(hours, 24))
        # 只能在公寓休息
        if not session.current_location.startswith("apartment"):
            await manager.send_to_player(player_id, {
                "type": "narrative_event",
                "data": {"type": "system", "text": "你需要回到公寓才能好好休息。"},
            })
            return
        new_session, events = Calculator.rest(session, hours)
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        await _send_events(player_id, events, new_session.current_location)
        return

    # ── 交房租 ──
    if action == "pay_rent":
        amount = float(payload.get("amount", 350.0))
        # 需要在公寓楼内
        if not session.current_location.startswith("apartment"):
            await manager.send_to_player(player_id, {
                "type": "narrative_event",
                "data": {"type": "system", "text": "你需要在公寓内找到管理员才能交房租。"},
            })
            return
        new_session, events = Calculator.pay_rent(session, amount)
        session_mgr.update_session(player_id, new_session)
        await send_full_state(player_id, new_session)
        await _send_events(player_id, events, new_session.current_location)
        return

    # ── 帮助 ──
    if action == "help":
        await manager.send_to_player(player_id, {
            "type": "narrative_event",
            "data": {"type": "system", "text": HELP_TEXT},
        })
        return

    # ── 互动（旧版兼容）──
    if action == "interact":
        target = payload.get("target", "")
        interact_action = payload.get("interact_action", "")
        if target == "sofa":
            if interact_action == "sit":
                text = "你坐在沙发上。弹簧有些塌陷，但比站着舒服多了。窗外传来远处的汽车喇叭声和隐约的人声喧嚣。"
            elif interact_action == "lie":
                text = "你躺在沙发上。天花板上有一道细长的裂缝，从灯座延伸到墙角。你盯着它看了一会儿，思绪逐渐放空。"
            else:
                text = f"你不知道怎么对沙发做 '{interact_action}'。"
            await manager.send_to_player(player_id, {
                "type": "narrative_event",
                "data": {"type": "scene", "text": text},
            })
            return

    # ── 未知指令 ──
    await manager.send_to_player(player_id, {
        "type": "narrative_event",
        "data": {"type": "system", "text": f"未知指令：{action}。输入 help 查看可用指令。"},
    })


async def send_full_state(player_id: str, session: GameSession):
    """向玩家推送完整游戏状态。"""
    loc = LOCATIONS.get(session.current_location, {})
    rels = session_mgr.get_relationships(player_id)
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
            "relationships": rels,
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
