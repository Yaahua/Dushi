"""WebSocket 全流程集成测试"""
import asyncio
import json
import websockets


async def test_ws():
    uri = "ws://localhost:8000/ws/test_player_1"
    async with websockets.connect(uri) as ws:
        # 1. 接收连接确认
        msg = json.loads(await ws.recv())
        print(f"1. 连接: {msg['type']} - {msg['data']['message']}")

        # 2. 发送 init
        await ws.send(json.dumps({"action": "init"}))
        msg = json.loads(await ws.recv())
        print(f"2. Init: phase={msg['data']['phase']}, intro_lines={len(msg['data']['intro_lines'])}")

        # 3. 推进 intro
        await ws.send(json.dumps({"action": "advance_intro"}))
        msg = json.loads(await ws.recv())
        print(f"3. Advance: intro_index={msg['data']['intro_index']}")

        # 4. 跳到最后（再推进5次到第7行，然后再推进1次进入 character_creation）
        for i in range(6):
            await ws.send(json.dumps({"action": "advance_intro"}))
            msg = json.loads(await ws.recv())
        print(f"4. Phase now: {msg['data']['phase']}")

        # 5. 完成角色创建
        await ws.send(json.dumps({"action": "set_gender", "gender": "\u5973"}))
        msg = json.loads(await ws.recv())
        await ws.send(json.dumps({"action": "set_skills", "skills": {"strength": 5, "intelligence": 5, "social": 5, "management": 5}}))
        msg = json.loads(await ws.recv())
        await ws.send(json.dumps({"action": "finish_creation", "name": "\u6d4b\u8bd5\u73a9\u5bb6"}))
        msg = json.loads(await ws.recv())
        print(f"5. Phase: {msg['data']['phase']}, name: {msg['data']['player']['name']}")

        # 6. 完成过渡
        await ws.send(json.dumps({"action": "finish_transit"}))
        msg1 = json.loads(await ws.recv())  # state_update
        msg2 = json.loads(await ws.recv())  # narrative_event (系统)
        msg3 = json.loads(await ws.recv())  # narrative_event (场景)
        print(f"6. Gameplay: phase={msg1['data']['phase']}, gt_running={msg1['data']['gt_running']}")
        print(f"   场景: {msg3['data']['location_name']}")

        # 7. 等待一个 tick 推送
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        print(f"7. Tick推送: gt_time={msg['data']['gt_time']}, hunger={msg['data']['player']['hunger']:.4f}")

        # 8. 移动到厨房
        await ws.send(json.dumps({"action": "goto", "target": "apartment_kitchen"}))
        msg = json.loads(await ws.recv())  # state_update
        msg2 = json.loads(await ws.recv())  # narrative_event
        print(f"8. 移动: location={msg['data']['current_location']}")

        # 9. 吃东西
        await ws.send(json.dumps({"action": "eat"}))
        msg = json.loads(await ws.recv())  # state_update
        msg2 = json.loads(await ws.recv())  # narrative_event
        print(f"9. 进食: food_supply={msg['data']['food_supply']}, text={msg2['data']['text']}")

        # 10. 环顾
        await ws.send(json.dumps({"action": "look"}))
        msg = json.loads(await ws.recv())
        print(f"10. 环顾: {msg['data']['text'][:30]}...")

        # 11. 查看背包
        await ws.send(json.dumps({"action": "inventory"}))
        msg = json.loads(await ws.recv())
        print(f"11. 背包: {msg['data']['text']}")

        # 12. 去便利店买水
        await ws.send(json.dumps({"action": "goto", "target": "apartment_main"}))
        await ws.recv()  # state
        await ws.recv()  # narrative
        await ws.send(json.dumps({"action": "goto", "target": "convenience_store"}))
        await ws.recv()  # state
        await ws.recv()  # narrative
        await ws.send(json.dumps({"action": "buy", "item": "water"}))
        msg = json.loads(await ws.recv())  # state
        msg2 = json.loads(await ws.recv())  # narrative
        print(f"12. 买水: money={msg['data']['player']['money']}, inv={msg['data']['inventory']}")

        # 13. 喝水
        await ws.send(json.dumps({"action": "drink_water"}))
        msg = json.loads(await ws.recv())
        msg2 = json.loads(await ws.recv())
        print(f"13. 喝水: stamina={msg['data']['player']['stamina']}, text={msg2['data']['text']}")

        print()
        print("=== WebSocket 全流程测试通过 ===")


asyncio.run(test_ws())
