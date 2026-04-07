"""
属性消耗与结算逻辑
将前端 GameContext 中的 GT_TICK / EAT / MOVE 等数值计算迁移至后端。
所有数值均来自制作人决策记录，不得擅自修改。
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List


# ─── 玩家状态数据结构 ────────────────────────────────────────────────
@dataclass
class PlayerStats:
    name: str = "新移民"
    gender: str = "男"
    health: float = 120.0
    max_health: float = 120.0
    stamina: float = 120.0
    max_stamina: float = 120.0
    hunger: float = 0.0        # 0 = 不饿，max_hunger = 饿死
    max_hunger: float = 100.0
    money: float = 2000.0
    money_frozen: bool = False
    skills: dict = field(default_factory=lambda: {
        "strength": 1, "intelligence": 1, "social": 1, "management": 1
    })

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "PlayerStats":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class GameSession:
    """单个玩家的完整游戏会话状态"""
    player: PlayerStats = field(default_factory=PlayerStats)
    current_location: str = "apartment_main"
    gt_time: int = 0              # GT 时间（分钟）
    gt_running: bool = False
    food_supply: int = 21         # 厨房食物剩余次数（一周三餐）
    inventory: List[dict] = field(default_factory=list)
    phase: str = "intro"          # intro / character_creation / transit / gameplay
    intro_index: int = 0

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


# ─── 结算计算器 ──────────────────────────────────────────────────────
class Calculator:
    """
    纯函数式结算器：接收状态，返回新状态 + 事件列表。
    不持有任何状态，方便测试。
    """

    # ── 饥饿速率：3 个游戏日从 0 到 max_hunger ──
    # 3天 = 3 * 24 * 60 = 4320 GT分钟
    HUNGER_DAYS = 3
    HUNGER_TICKS = HUNGER_DAYS * 24 * 60  # 4320

    # ── 生命值扣除：饥饿满后 1.5 个游戏日从 max_health 到 0 ──
    # 1.5天 = 1.5 * 24 * 60 = 2160 GT分钟
    HEALTH_DRAIN_DAYS = 1.5
    HEALTH_DRAIN_TICKS = HEALTH_DRAIN_DAYS * 24 * 60  # 2160

    # ── 进食数值（决策 #3）──
    EAT_HUNGER_REDUCTION = 10
    EAT_STAMINA_RECOVERY = 2
    EAT_STAMINA_THRESHOLD = 0.5  # 饥饿 <= 50% 才恢复体能

    # ── 移动消耗 ──
    INDOOR_MOVE_COST = 1
    OUTDOOR_MOVE_COST = 3

    @staticmethod
    def tick(session: GameSession) -> tuple[GameSession, List[dict]]:
        """
        执行一次 GT Tick（1 GT 分钟）。
        返回 (新会话状态, 事件列表)。
        """
        if not session.gt_running:
            return session, []

        events: List[dict] = []
        p = session.player

        # 时间推进
        new_gt_time = session.gt_time + 1

        # 饥饿增长
        hunger_rate = p.max_hunger / Calculator.HUNGER_TICKS
        new_hunger = min(p.max_hunger, p.hunger + hunger_rate)

        # 生命值扣除（饥饿满值后）
        new_health = p.health
        is_starving = new_hunger >= p.max_hunger
        if is_starving:
            health_drain_rate = p.max_health / Calculator.HEALTH_DRAIN_TICKS
            new_health = max(0, new_health - health_drain_rate)

        # 昏迷判定（决策 #4）
        if new_health <= 0 and p.health > 0:
            events.append({
                "type": "danger",
                "text": "你的视线逐渐模糊，身体再也支撑不住了……你昏倒在地。（昏迷）",
            })

        # 更新状态
        new_player = PlayerStats(
            name=p.name, gender=p.gender,
            health=new_health, max_health=p.max_health,
            stamina=p.stamina, max_stamina=p.max_stamina,
            hunger=new_hunger, max_hunger=p.max_hunger,
            money=p.money, money_frozen=p.money_frozen,
            skills=dict(p.skills),
        )
        new_session = GameSession(
            player=new_player,
            current_location=session.current_location,
            gt_time=new_gt_time,
            gt_running=session.gt_running,
            food_supply=session.food_supply,
            inventory=list(session.inventory),
            phase=session.phase,
            intro_index=session.intro_index,
        )
        return new_session, events

    @staticmethod
    def eat(session: GameSession) -> tuple[GameSession, List[dict]]:
        """执行进食动作。"""
        events: List[dict] = []
        p = session.player

        if session.food_supply <= 0:
            events.append({"type": "danger", "text": "冰箱里已经没有食物了。"})
            return session, events

        # 降低饥饿
        new_hunger = max(0, p.hunger - Calculator.EAT_HUNGER_REDUCTION)

        # 饥饿阈值联动（决策 #3）：<=50% 才恢复体能
        hunger_percent = new_hunger / p.max_hunger
        can_recover = hunger_percent <= Calculator.EAT_STAMINA_THRESHOLD
        stamina_recovery = Calculator.EAT_STAMINA_RECOVERY if can_recover else 0
        new_stamina = min(p.max_stamina, p.stamina + stamina_recovery)

        events.append({"type": "system", "text": "你放下碗筷，胃里传来满足的暖意。"})

        new_player = PlayerStats(
            name=p.name, gender=p.gender,
            health=p.health, max_health=p.max_health,
            stamina=new_stamina, max_stamina=p.max_stamina,
            hunger=new_hunger, max_hunger=p.max_hunger,
            money=p.money, money_frozen=p.money_frozen,
            skills=dict(p.skills),
        )
        new_session = GameSession(
            player=new_player,
            current_location=session.current_location,
            gt_time=session.gt_time,
            gt_running=session.gt_running,
            food_supply=session.food_supply - 1,
            inventory=list(session.inventory),
            phase=session.phase,
            intro_index=session.intro_index,
        )
        return new_session, events

    @staticmethod
    def move(session: GameSession, target_id: str, locations: dict) -> tuple[GameSession, List[dict]]:
        """执行移动动作，扣除体能。"""
        events: List[dict] = []

        target = locations.get(target_id)
        if not target:
            events.append({"type": "system", "text": f"你不知道\u201c{target_id}\u201d在哪里。"})
            return session, events

        current = locations.get(session.current_location, {})
        is_indoor = target.get("type") == "indoor" and current.get("type") == "indoor"
        cost = Calculator.INDOOR_MOVE_COST if is_indoor else Calculator.OUTDOOR_MOVE_COST
        new_stamina = max(0, session.player.stamina - cost)

        events.append({
            "type": "scene",
            "text": target.get("description", ""),
            "location_name": target.get("name", target_id),
        })

        p = session.player
        new_player = PlayerStats(
            name=p.name, gender=p.gender,
            health=p.health, max_health=p.max_health,
            stamina=new_stamina, max_stamina=p.max_stamina,
            hunger=p.hunger, max_hunger=p.max_hunger,
            money=p.money, money_frozen=p.money_frozen,
            skills=dict(p.skills),
        )
        new_session = GameSession(
            player=new_player,
            current_location=target_id,
            gt_time=session.gt_time,
            gt_running=session.gt_running,
            food_supply=session.food_supply,
            inventory=list(session.inventory),
            phase=session.phase,
            intro_index=session.intro_index,
        )
        return new_session, events

    @staticmethod
    def buy_water(session: GameSession) -> tuple[GameSession, List[dict]]:
        """购买矿泉水。"""
        events: List[dict] = []
        p = session.player
        WATER_PRICE = 2

        if p.money < WATER_PRICE:
            events.append({"type": "danger", "text": "你的余额不足。"})
            return session, events

        # 更新背包
        new_inv = list(session.inventory)
        found = False
        for item in new_inv:
            if item["id"] == "water":
                item["quantity"] += 1
                found = True
                break
        if not found:
            new_inv.append({"id": "water", "name": "矿泉水", "quantity": 1})

        events.append({"type": "system", "text": "收银员面无表情地接过钱，从柜台下拿出一瓶矿泉水放在你面前。"})

        new_player = PlayerStats(
            name=p.name, gender=p.gender,
            health=p.health, max_health=p.max_health,
            stamina=p.stamina, max_stamina=p.max_stamina,
            hunger=p.hunger, max_hunger=p.max_hunger,
            money=p.money - WATER_PRICE, money_frozen=p.money_frozen,
            skills=dict(p.skills),
        )
        new_session = GameSession(
            player=new_player,
            current_location=session.current_location,
            gt_time=session.gt_time,
            gt_running=session.gt_running,
            food_supply=session.food_supply,
            inventory=new_inv,
            phase=session.phase,
            intro_index=session.intro_index,
        )
        return new_session, events

    @staticmethod
    def drink_water(session: GameSession) -> tuple[GameSession, List[dict]]:
        """喝矿泉水。"""
        events: List[dict] = []
        p = session.player

        water = next((i for i in session.inventory if i["id"] == "water"), None)
        if not water or water["quantity"] <= 0:
            events.append({"type": "system", "text": "你没有矿泉水。"})
            return session, events

        new_inv = []
        for item in session.inventory:
            if item["id"] == "water":
                if item["quantity"] > 1:
                    new_inv.append({**item, "quantity": item["quantity"] - 1})
                # quantity == 1 则移除
            else:
                new_inv.append(dict(item))

        new_stamina = min(p.max_stamina, p.stamina + 1)
        events.append({"type": "system", "text": "你喝了一瓶矿泉水。"})

        new_player = PlayerStats(
            name=p.name, gender=p.gender,
            health=p.health, max_health=p.max_health,
            stamina=new_stamina, max_stamina=p.max_stamina,
            hunger=p.hunger, max_hunger=p.max_hunger,
            money=p.money, money_frozen=p.money_frozen,
            skills=dict(p.skills),
        )
        new_session = GameSession(
            player=new_player,
            current_location=session.current_location,
            gt_time=session.gt_time,
            gt_running=session.gt_running,
            food_supply=session.food_supply,
            inventory=new_inv,
            phase=session.phase,
            intro_index=session.intro_index,
        )
        return new_session, events
