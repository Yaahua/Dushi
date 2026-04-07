# 已知问题清单

> 最后更新：2026-04-07 — 规划变更落地（决策 #5、#6）

## 待修复

### 1. 数据库 / Redis 未连接（开发环境）

**现象**：`/api/health` 返回 `degraded`，database 和 redis 均为 error。

**原因**：当前沙箱环境未启动 Docker（`docker-compose up`），PostgreSQL 和 Redis 服务不可用。

**影响**：不影响 WebSocket 游戏流程，会话数据存储在内存中。第二阶段持久化开发时需要启动 Docker。

**优先级**：中（第二阶段前置条件）

---

### 2. Python f-string 中文引号语法错误（预防记录）

**已修复文件**：
- `server/app/engine/calculator.py`（第 182 行）
- `server/app/api/websocket.py`（第 249 行）

**根因**：Python 3.11 的 f-string 解析器将中文引号 `"` 和 `"` 视为字符串定界符，与外层双引号冲突。

**预防措施**：在 Python f-string 中使用 Unicode 转义 `\u201c` / `\u201d` 代替中文引号，或使用单引号包裹 f-string。

**优先级**：已修复（记录以防复发）

---

## 已修复

| 编号 | 问题 | 修复提交 |
|:---|:---|:---|
| Bug-01 | 叙事流文字未居中 | 第一阶段早期 |
| Bug-02 | 上楼回公寓链接失效 | 第一阶段早期 |
| Bug-03 | 饥饿联动逻辑错误 | 第一阶段早期 |
| Bug-04 | 生命值系统缺失 | 第一阶段早期 |
| f-string 语法错误 | calculator.py / websocket.py | bde29ed |
| WebSocket 路由 404 | Dockerfile 移除 `--reload`，避免热重载时路由表未刷新 | beef8ee |
| Vite 代理未配置 | `vite.config.ts` 添加 `/ws` + `/api` 代理，`useWebSocket.ts` 改为同源连接 | beef8ee |

## 已关闭（不再适用）

| 编号 | 问题 | 原因 |
|:---|:---|:---|
| 步骤 1.8 火车站场景 | 原规划要求火车站起始场景 | 决策 #5：取消火车站，以世界公寓为准 |
