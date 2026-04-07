# 已知问题清单

> 最后更新：2026-04-07 — 第一阶段后端迁移完成后

## 待修复

### 1. WebSocket 路由 404（开发环境）

**现象**：后端以 `uvicorn --reload` 模式启动后，WebSocket 路由 `/ws/{player_id}` 偶尔返回 HTTP 404。

**原因**：疑似 uvicorn `--reload` 模式在热重载时路由表未正确刷新。路由注册代码本身正确（`python -c "from app.main import app"` 可以看到 `APIWebSocketRoute` 已注册）。

**临时方案**：重启 uvicorn 进程（不使用 `--reload`）。

**优先级**：低（仅影响开发环境）

---

### 2. 数据库 / Redis 未连接（开发环境）

**现象**：`/api/health` 返回 `degraded`，database 和 redis 均为 error。

**原因**：当前沙箱环境未启动 Docker（`docker-compose up`），PostgreSQL 和 Redis 服务不可用。

**影响**：不影响 WebSocket 游戏流程，会话数据存储在内存中。第二阶段持久化开发时需要启动 Docker。

**优先级**：中（第二阶段前置条件）

---

### 3. 前端 Vite 代理未配置 WebSocket 转发

**现象**：前端开发服务器（端口 3000）无法自动代理 WebSocket 请求到后端（端口 8000）。

**原因**：`vite.config.ts` 中未配置 `server.proxy` 将 `/ws` 路径转发到后端。当前前端 `useWebSocket.ts` 中硬编码连接 `localhost:8000`。

**修复方案**：在 `vite.config.ts` 中添加：
```ts
server: {
  proxy: {
    '/ws': {
      target: 'http://localhost:8000',
      ws: true,
    },
  },
}
```

**优先级**：中（影响前后端联调体验）

---

### 4. 步骤 1.8 火车站场景未实现

**现象**：当前场景为"世界公寓"（3 个地点），路线图要求的火车站区漫游链节点尚未实现。

**原因**：火车站场景需要制作人提供场景文案、地点拓扑、NPC 数据。

**依赖**：制作人提供火车站区域设计数据。

**优先级**：中（第一阶段收尾）

---

### 5. Python f-string 中文引号语法错误

**现象**：Python 3.11 的 f-string 中使用中文引号 `""` 会导致 `SyntaxError`。

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
