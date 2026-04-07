# 已知问题清单

> 最后更新：2026-04-07 — 规划变更落地（决策 #5、#6）

## AI 开发环境限制

> **重要提示**：当前 AI 沙箱环境不支持 Docker，因此 PostgreSQL 和 Redis 服务不可用。这不是 Bug，后续本地开发时会通过 `docker-compose up` 正常启动。AI 开发时**不要尝试启动或调试数据库/Redis 连接**，避免无意义的试错和 token 浪费。后端 `/api/health` 返回 `degraded` 属于正常现象，不影响 WebSocket 游戏流程（会话数据存储在内存中）。

---

## 待修复

（当前无待修复项）

---

## 编码注意事项

### Python f-string 中文引号

**已修复文件**：`server/app/engine/calculator.py`、`server/app/api/websocket.py`

**预防措施**：在 Python f-string 中禁止直接使用中文引号 `""`，必须用 Unicode 转义 `\u201c` / `\u201d`，或使用单引号包裹 f-string。

---

## 已修复

| 编号 | 问题 | 修复提交 |
|:---|:---|:---|
| Bug-01 | 叙事流文字未居中 | 第一阶段早期 |
| Bug-02 | 上楼回公寓链接失效 | 第一阶段早期 |
| Bug-03 | 饥饿联动逻辑错误 | 第一阶段早期 |
| Bug-04 | 生命值系统缺失 | 第一阶段早期 |
| f-string 语法错误 | calculator.py / websocket.py | bde29ed |
| WebSocket 路由 404 | Dockerfile 移除 `--reload` | beef8ee |
| Vite 代理未配置 | `vite.config.ts` + `useWebSocket.ts` | beef8ee |

## 已关闭（不再适用）

| 编号 | 问题 | 原因 |
|:---|:---|:---|
| 步骤 1.8 火车站场景 | 原规划要求火车站起始场景 | 决策 #5：取消火车站，以世界公寓为准 |
