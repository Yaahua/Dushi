# 本地开发环境搭建指南

本文档说明如何在本地运行《都市余烬》的完整开发环境（前端 + 后端 + 数据库 + 缓存）。

---

## 前置要求

| 工具 | 用途 | 下载地址 |
| :--- | :--- | :--- |
| **Docker Desktop** | 一键拉起 PostgreSQL、Redis 和后端服务 | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Node.js 18+** | 运行前端开发服务器 | [nodejs.org](https://nodejs.org/) |
| **Git** | 克隆仓库 | [git-scm.com](https://git-scm.com/) |

安装 Docker Desktop 后，启动它并确认右下角图标显示为绿色 **Running** 状态，再继续以下步骤。

---

## 第一步：克隆仓库

```bash
git clone https://github.com/Yaahua/Dushi.git
cd Dushi
```

---

## 第二步：配置后端环境变量

```bash
cd server
cp .env.example .env
```

`.env.example` 中的默认值已可直接用于本地开发，**无需修改任何内容**。

---

## 第三步：启动后端（Docker Compose）

```bash
# 确保当前在 server/ 目录下
docker-compose up --build
```

首次运行会自动下载 PostgreSQL 和 Redis 镜像，约需 2～5 分钟。启动成功后终端输出如下：

```
dushi_db    | database system is ready to accept connections
dushi_redis | Ready to accept connections
dushi_api   | 🚀 都市余烬后端启动中...
dushi_api   | ✅ Redis 连接成功
dushi_api   | ✅ 数据库连接成功
dushi_api   | 🌆 都市余烬后端已就绪
dushi_api   | INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 验证后端运行

| 地址 | 说明 |
| :--- | :--- |
| `http://localhost:8000/docs` | Swagger 交互式 API 文档 |
| `http://localhost:8000/api/health` | 健康检查（返回 DB 与 Redis 状态） |
| `ws://localhost:8000/ws/player1` | WebSocket 连接测试 |

---

## 第四步：启动前端（另开终端）

```bash
# 回到项目根目录
cd ../mvp-src

# 安装依赖（首次需要）
npm install --legacy-peer-deps

# 启动开发服务器
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端运行在 `http://localhost:8000`，CORS 已预先配置，可直接联调。

---

## 常用 Docker 命令

```bash
# 停止所有服务（保留数据库数据）
docker-compose down

# 停止并清除所有数据（完全重置）
docker-compose down -v

# 仅重启后端 API（不重建镜像）
docker-compose restart api

# 实时查看后端日志
docker-compose logs -f api

# 重新构建并启动（代码有变更时使用）
docker-compose up --build
```

---

## 目录结构说明

```
Dushi/
├── mvp-src/          # 前端（React + TypeScript + Vite）
├── server/           # 后端（FastAPI + PostgreSQL + Redis）
│   ├── app/          # 应用代码
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example  # 环境变量模板（复制为 .env 使用）
└── LOCAL_SETUP.md    # 本文件
```

---

## 常见问题

**Q：`docker-compose up` 报端口冲突怎么办？**

本地的 `5432`（PostgreSQL）或 `6379`（Redis）端口已被占用时，编辑 `server/docker-compose.yml`，将对应的 `ports` 左侧端口号改为其他值（如 `5433:5432`），同时更新 `server/.env` 中的连接地址。

**Q：前端页面空白或报网络错误？**

确认后端已正常启动（`http://localhost:8000/api/health` 返回 `"status": "ok"`），并检查浏览器控制台是否有 CORS 报错。

**Q：如何完全重置数据库？**

```bash
cd server
docker-compose down -v   # -v 参数会删除数据卷
docker-compose up --build
```
