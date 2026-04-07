"""
会话管理器
管理所有在线玩家的游戏会话状态（内存中）。
第二阶段将接入 PostgreSQL 持久化。
"""

from __future__ import annotations

from typing import Dict, List, Optional
from app.engine.calculator import GameSession, PlayerStats


# ─── 世界公寓场景数据（与前端 LOCATIONS 保持一致）─────────────────────
LOCATIONS: Dict[str, dict] = {
    "apartment_main": {
        "id": "apartment_main",
        "name": "世界公寓 - 客厅",
        "description": "一间狭小但整洁的公寓客厅。灰白色的墙壁上挂着一幅褪色的城市地图。"
                       "一张深灰色布艺沙发靠在窗边，窗外是密密麻麻的高楼轮廓。茶几上放着一份入住须知。",
        "type": "indoor",
        "children": ["apartment_kitchen"],
        "actions": [
            {"label": "去厨房", "command": "goto apartment_kitchen"},
            {"label": "下楼", "command": "goto convenience_store"},
        ],
    },
    "apartment_kitchen": {
        "id": "apartment_kitchen",
        "name": "世界公寓 - 厨房",
        "description": "一间紧凑的厨房，配备了基本的灶台和冰箱。"
                       "冰箱里存放着一周份量的基础食材——几袋速食米饭、罐头蔬菜和冷冻肉类。",
        "type": "indoor",
        "parent": "apartment_main",
        "actions": [
            {"label": "吃东西", "command": "eat"},
            {"label": "去客厅", "command": "goto apartment_main"},
        ],
    },
    "convenience_store": {
        "id": "convenience_store",
        "name": "楼下便利店",
        "description": "公寓楼下的一间 24 小时便利店。白色的日光灯照亮了整齐排列的货架。"
                       "收银台后面坐着一个面无表情的中年店员，正盯着一台小电视。",
        "type": "street",
        "parent": "apartment_main",
        "actions": [
            {"label": "买矿泉水 (¥2)", "command": "buy water"},
            {"label": "上楼回公寓", "command": "goto apartment_main"},
        ],
    },
}


class SessionManager:
    """
    内存会话管理器。
    每个在线玩家对应一个 GameSession 实例。
    """

    def __init__(self):
        self._sessions: Dict[str, GameSession] = {}

    def create_session(self, player_id: str, name: str = "新移民", gender: str = "男",
                       skills: Optional[dict] = None) -> GameSession:
        """为新玩家创建会话。"""
        player = PlayerStats(
            name=name,
            gender=gender,
            skills=skills or {"strength": 1, "intelligence": 1, "social": 1, "management": 1},
        )
        session = GameSession(player=player)
        self._sessions[player_id] = session
        return session

    def get_session(self, player_id: str) -> Optional[GameSession]:
        return self._sessions.get(player_id)

    def update_session(self, player_id: str, session: GameSession):
        self._sessions[player_id] = session

    def remove_session(self, player_id: str):
        self._sessions.pop(player_id, None)

    def get_online_player_ids(self) -> List[str]:
        return list(self._sessions.keys())

    def get_locations(self) -> Dict[str, dict]:
        return LOCATIONS
