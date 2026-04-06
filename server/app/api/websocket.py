from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
import json

router = APIRouter()


class ConnectionManager:
    """管理所有在线玩家的 WebSocket 连接"""

    def __init__(self):
        # player_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, player_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[player_id] = websocket

    def disconnect(self, player_id: str):
        self.active_connections.pop(player_id, None)

    async def send_to_player(self, player_id: str, message: dict):
        """向指定玩家推送消息"""
        ws = self.active_connections.get(player_id)
        if ws:
            await ws.send_text(json.dumps(message, ensure_ascii=False))

    async def broadcast(self, message: dict):
        """向所有在线玩家广播消息"""
        for ws in self.active_connections.values():
            await ws.send_text(json.dumps(message, ensure_ascii=False))


manager = ConnectionManager()


@router.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    """
    WebSocket 连接入口。
    阶段一：仅建立连接并回显消息，用于验证通信链路。
    阶段二：接入指令处理与状态推送。
    """
    await manager.connect(player_id, websocket)
    await manager.send_to_player(player_id, {
        "type": "system",
        "text": f"连接成功，玩家 ID：{player_id}",
    })
    try:
        while True:
            data = await websocket.receive_text()
            # 阶段一：原样回显，验证双向通信
            await manager.send_to_player(player_id, {
                "type": "echo",
                "text": f"[回显] {data}",
            })
    except WebSocketDisconnect:
        manager.disconnect(player_id)
