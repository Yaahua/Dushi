"""
设定数据加载器
从 YAML 设定文件加载地图、NPC、事件链数据，转换为引擎可用格式。
"""
from __future__ import annotations
import os
import yaml
from typing import Dict, List, Optional

# 设定文件根目录（相对于 server 目录的上级）
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
_SETTINGS_DIR = os.path.join(_BASE_DIR, "设定")


def _load_yaml(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_all_locations() -> Dict[str, dict]:
    """
    加载所有地图 YAML，合并为引擎使用的 LOCATIONS 字典。
    格式: { spot_id: { id, name, description, type, connections, actions, properties, ... } }
    """
    locations: Dict[str, dict] = {}
    map_dir = os.path.join(_SETTINGS_DIR, "map")
    if not os.path.isdir(map_dir):
        return locations

    for fname in os.listdir(map_dir):
        if not fname.endswith(".yaml"):
            continue
        data = _load_yaml(os.path.join(map_dir, fname))
        spots = data.get("spots", [])
        for spot in spots:
            sid = spot.get("id")
            if not sid:
                continue
            # 将 connections 转换为 actions（前端快捷按钮）
            connections = spot.get("connections", [])
            actions = _connections_to_actions(connections, spot)
            # 判断 indoor/outdoor
            loc_type = "indoor" if spot.get("indoor", True) else "street"
            locations[sid] = {
                "id": sid,
                "name": spot.get("name", sid),
                "description": spot.get("description", ""),
                "type": loc_type,
                "connections": connections,
                "actions": actions,
                "tags": spot.get("tags", []),
                "safety_level": spot.get("safety_level", "normal"),
                "crowd_density": spot.get("crowd_density", "normal"),
                "properties": spot.get("properties", {}),
                "time_based_description": spot.get("time_based_description", {}),
                "npcs_present": spot.get("properties", {}).get("npcs_present", []),
                "area": data.get("id", "unknown"),
                "area_name": data.get("name", ""),
            }
    return locations


def _connections_to_actions(connections: List[dict], spot: dict) -> List[dict]:
    """将 connections 列表转换为前端 actions 按钮列表。"""
    actions = []
    for conn in connections:
        target = conn.get("target", "")
        condition = conn.get("condition")
        label = f"前往 {target}"
        cmd = f"goto {target}"
        action = {"label": label, "command": cmd}
        if condition:
            action["condition"] = condition
        actions.append(action)
    return actions


def load_all_npcs() -> Dict[str, dict]:
    """
    加载所有 NPC YAML，合并为 NPC 字典。
    格式: { npc_id: { id, name, role, dialogues, ... } }
    """
    npcs: Dict[str, dict] = {}
    npc_dir = os.path.join(_SETTINGS_DIR, "npc")
    if not os.path.isdir(npc_dir):
        return npcs

    for root, dirs, files in os.walk(npc_dir):
        for fname in files:
            if not fname.endswith(".yaml"):
                continue
            data = _load_yaml(os.path.join(root, fname))
            for npc in data.get("npcs", []):
                nid = npc.get("id")
                if nid:
                    npcs[nid] = npc
    return npcs


def load_event_chains() -> Dict[str, dict]:
    """
    加载事件链设定。
    格式: { chain_id: { ... } }
    """
    chains: Dict[str, dict] = {}
    events_dir = os.path.join(_SETTINGS_DIR, "events")
    if not os.path.isdir(events_dir):
        return chains

    for fname in os.listdir(events_dir):
        if not fname.endswith(".yaml"):
            continue
        data = _load_yaml(os.path.join(events_dir, fname))
        for chain in data.get("event_chains", []):
            cid = chain.get("id")
            if cid:
                chains[cid] = chain
    return chains


def load_random_events() -> List[dict]:
    """加载随机事件列表。"""
    events: List[dict] = []
    events_dir = os.path.join(_SETTINGS_DIR, "events")
    if not os.path.isdir(events_dir):
        return events

    for fname in os.listdir(events_dir):
        if not fname.endswith(".yaml"):
            continue
        data = _load_yaml(os.path.join(events_dir, fname))
        events.extend(data.get("random_events", []))
    return events


def get_spot_shop_items(spot_id: str, locations: Dict[str, dict]) -> List[dict]:
    """获取某地点的商店商品列表。"""
    loc = locations.get(spot_id, {})
    return loc.get("properties", {}).get("shop_items", [])


def get_spot_menu(spot_id: str, locations: Dict[str, dict]) -> List[dict]:
    """获取某地点的菜单列表。"""
    loc = locations.get(spot_id, {})
    return loc.get("properties", {}).get("menu", [])


def get_npc_greeting(npc: dict) -> str:
    """随机获取 NPC 的问候语。"""
    import random
    greetings = npc.get("dialogues", {}).get("greeting", [])
    if not greetings:
        return f"{npc.get('name', '?')} 看了你一眼，没有说话。"
    return random.choice(greetings)


def get_npc_dialogue(npc: dict, topic_id: str, relationship: int = 0) -> Optional[str]:
    """根据话题 ID 和关系值获取 NPC 对话。"""
    import random
    topics = npc.get("dialogues", {}).get("topics", [])
    for topic in topics:
        if topic.get("id") != topic_id:
            continue
        # 检查关系值条件
        condition = topic.get("condition", "")
        if condition:
            # 简单解析 "relationship > N" 格式
            try:
                parts = condition.split()
                if len(parts) == 3 and parts[1] == ">":
                    threshold = int(parts[2])
                    if relationship <= threshold:
                        continue
            except (ValueError, IndexError):
                pass
        lines = topic.get("lines", [])
        if lines:
            return random.choice(lines)
    return None


# ─── 单例缓存 ─────────────────────────────────────────────────────────
_locations_cache: Optional[Dict[str, dict]] = None
_npcs_cache: Optional[Dict[str, dict]] = None
_event_chains_cache: Optional[Dict[str, dict]] = None
_random_events_cache: Optional[List[dict]] = None


def get_locations() -> Dict[str, dict]:
    global _locations_cache
    if _locations_cache is None:
        _locations_cache = load_all_locations()
    return _locations_cache


def get_npcs() -> Dict[str, dict]:
    global _npcs_cache
    if _npcs_cache is None:
        _npcs_cache = load_all_npcs()
    return _npcs_cache


def get_event_chains() -> Dict[str, dict]:
    global _event_chains_cache
    if _event_chains_cache is None:
        _event_chains_cache = load_event_chains()
    return _event_chains_cache


def get_random_events() -> List[dict]:
    global _random_events_cache
    if _random_events_cache is None:
        _random_events_cache = load_random_events()
    return _random_events_cache


def reload_all():
    """重新加载所有设定（开发时使用）。"""
    global _locations_cache, _npcs_cache, _event_chains_cache, _random_events_cache
    _locations_cache = None
    _npcs_cache = None
    _event_chains_cache = None
    _random_events_cache = None
