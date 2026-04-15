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
            events.append({"type": "system", "text": f"你不知道「{target_id}」在哪里。"})
            return session, events

        current = locations.get(session.current_location, {})
        # 同一建筑内移动（两者都是 indoor）消耗低；跨越室外消耗高
        both_indoor = target.get("type") == "indoor" and current.get("type") == "indoor"
        cost = Calculator.INDOOR_MOVE_COST if both_indoor else Calculator.OUTDOOR_MOVE_COST
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

    # ─── 扩展动作：购买商品（通用）────────────────────────────────────────

    @staticmethod
    def buy_item(session: "GameSession", item_id: str, locations: dict) -> tuple["GameSession", list]:
        """通用购买动作：从当前地点的 shop_items 或 menu 中购买指定商品。"""
        events: list = []
        p = session.player
        loc = locations.get(session.current_location, {})
        props = loc.get("properties", {})

        all_items = props.get("shop_items", []) + props.get("menu", [])
        item_def = next((i for i in all_items if i.get("id") == item_id), None)

        if not item_def:
            events.append({"type": "system", "text": f"这里没有'{item_id}'这个商品。"})
            return session, events

        price = item_def.get("price", 0)
        if p.money < price:
            events.append({"type": "danger", "text": f"你的余额不足，需要 ¥{price}，当前余额 ¥{p.money:.0f}。"})
            return session, events

        new_money = p.money - price
        hunger_reduction = item_def.get("hunger_reduction", 0)
        stamina_recovery = item_def.get("stamina_recovery", 0)
        side_effect = item_def.get("side_effect", "")

        new_hunger = max(0.0, p.hunger - hunger_reduction)
        new_stamina = min(p.max_stamina, p.stamina + stamina_recovery)

        if "hunger_increase" in side_effect:
            try:
                amt = float(side_effect.split("_")[-1])
                new_hunger = min(p.max_hunger, new_hunger + amt)
            except ValueError:
                pass
        if "stamina_reduce" in side_effect:
            try:
                amt = float(side_effect.split("_")[-1])
                new_stamina = max(0.0, new_stamina - amt)
            except ValueError:
                pass

        item_name = item_def.get("name", item_id)
        events.append({"type": "system", "text": f"你购买了{item_name}（¥{price}），余额剩余 ¥{new_money:.0f}。"})
        if hunger_reduction > 0:
            events.append({"type": "system", "text": "饥饿感减轻了一些。"})
        if stamina_recovery > 0:
            events.append({"type": "system", "text": "体力略有恢复。"})

        new_player = PlayerStats(
            name=p.name, gender=p.gender,
            health=p.health, max_health=p.max_health,
            stamina=new_stamina, max_stamina=p.max_stamina,
            hunger=new_hunger, max_hunger=p.max_hunger,
            money=new_money, money_frozen=p.money_frozen,
            skills=dict(p.skills),
        )
        new_session = GameSession(
            player=new_player,
            current_location=session.current_location,
            gt_time=session.gt_time,
            gt_running=session.gt_running,
            food_supply=session.food_supply,
            inventory=list(session.inventory),
            phase=session.phase,
            intro_index=session.intro_index,
        )
        return new_session, events

    # ─── 扩展动作：支付房租 ────────────────────────────────────────────────

    @staticmethod
    def pay_rent(session: "GameSession", amount: float = 350.0) -> tuple["GameSession", list]:
        """支付房租。"""
        events: list = []
        p = session.player

        if p.money < amount:
            events.append({"type": "danger", "text": f"你的余额不足以支付房租 ¥{amount:.0f}，当前余额 ¥{p.money:.0f}。"})
            return session, events

        new_money = p.money - amount
        events.append({"type": "system", "text": f"你交了 ¥{amount:.0f} 的房租。余额剩余 ¥{new_money:.0f}。"})
        events.append({
            "type": "scene",
            "text": "管理员老陈收下钱，在本子上记了一笔，点了点头。\n\"收到了。\"他没有多说，转身走了。\n你又多了一个月的安稳。",
        })

        new_player = PlayerStats(
            name=p.name, gender=p.gender,
            health=p.health, max_health=p.max_health,
            stamina=p.stamina, max_stamina=p.max_stamina,
            hunger=p.hunger, max_hunger=p.max_hunger,
            money=new_money, money_frozen=p.money_frozen,
            skills=dict(p.skills),
        )
        new_session = GameSession(
            player=new_player,
            current_location=session.current_location,
            gt_time=session.gt_time,
            gt_running=session.gt_running,
            food_supply=session.food_supply,
            inventory=list(session.inventory),
            phase=session.phase,
            intro_index=session.intro_index,
        )
        return new_session, events

    # ─── 扩展动作：查看当前地点详情 ──────────────────────────────────────

    @staticmethod
    def look(session: "GameSession", locations: dict) -> tuple["GameSession", list]:
        """查看当前地点的详细描述，包含时间相关描述。"""
        events: list = []
        loc = locations.get(session.current_location, {})
        if not loc:
            events.append({"type": "system", "text": "你环顾四周，什么都没有发现。"})
            return session, events

        gt_hour = (session.gt_time % (24 * 60)) // 60
        if 5 <= gt_hour < 9:
            time_key = "morning"
        elif 9 <= gt_hour < 17:
            time_key = "day"
        elif 17 <= gt_hour < 21:
            time_key = "evening"
        else:
            time_key = "night"

        base_desc = loc.get("description", "").strip()
        time_desc = loc.get("time_based_description", {}).get(time_key, "")
        full_desc = base_desc + (f"\n\n{time_desc}" if time_desc else "")

        events.append({
            "type": "scene",
            "text": full_desc,
            "location_name": loc.get("name", session.current_location),
        })

        npcs_present = loc.get("npcs_present", [])
        visible_npcs = [
            n.get("npc_id", "") for n in npcs_present
            if "all" in n.get("schedule", []) or time_key in n.get("schedule", [])
        ]
        if visible_npcs:
            events.append({
                "type": "system",
                "text": f"这里有人：{', '.join(visible_npcs)}。你可以用 talk <名字> 和他们交谈。",
            })

        return session, events

    # ─── 扩展动作：NPC 对话 ────────────────────────────────────────────────

    @staticmethod
    def talk_to_npc(
        session: "GameSession",
        npc_id: str,
        npcs: dict,
        topic: str = "greeting",
        relationships: dict = None,
    ) -> tuple["GameSession", list]:
        """与 NPC 对话。"""
        events: list = []
        npc = npcs.get(npc_id)
        if not npc:
            events.append({"type": "system", "text": f"你找不到叫'{npc_id}'的人。"})
            return session, events

        rel = (relationships or {}).get(npc_id, npc.get("relationship_initial", 0))
        npc_name = npc.get("name", npc_id)

        if topic == "greeting":
            from app.engine.data_loader import get_npc_greeting
            line = get_npc_greeting(npc)
        else:
            from app.engine.data_loader import get_npc_dialogue
            line = get_npc_dialogue(npc, topic, rel)
            if not line:
                line = f"{npc_name} 看了你一眼，没有回应。"

        events.append({"type": "dialogue", "speaker": npc_name, "text": line})
        return session, events

    # ─── 扩展动作：休息恢复体能 ────────────────────────────────────────────

    @staticmethod
    def rest(session: "GameSession", hours: int = 8) -> tuple["GameSession", list]:
        """休息指定小时数，恢复体能和健康，消耗时间。"""
        events: list = []
        p = session.player

        stamina_per_hour = 10.0
        health_per_hour = 2.0
        hunger_per_hour = 3.0

        total_stamina = min(p.max_stamina, p.stamina + stamina_per_hour * hours)
        total_health = min(p.max_health, p.health + health_per_hour * hours)
        total_hunger = min(p.max_hunger, p.hunger + hunger_per_hour * hours)
        new_gt_time = session.gt_time + hours * 60

        events.append({"type": "system", "text": f"你休息了 {hours} 小时。体力恢复至 {total_stamina:.0f}。"})
        if total_hunger > p.max_hunger * 0.7:
            events.append({"type": "warning", "text": "醒来后，你感到很饿。"})

        new_player = PlayerStats(
            name=p.name, gender=p.gender,
            health=total_health, max_health=p.max_health,
            stamina=total_stamina, max_stamina=p.max_stamina,
            hunger=total_hunger, max_hunger=p.max_hunger,
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
