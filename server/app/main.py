from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.core.redis import init_redis, close_redis
from app.api.routes import router as http_router
from app.api.websocket import router as ws_router, manager as ws_manager, session_mgr
from app.engine.tick import TickEngine

# 全局 Tick 引擎实例
tick_engine = TickEngine(ws_manager=ws_manager, session_mgr=session_mgr)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化连接，关闭时释放资源"""
    print("🚀 都市余烬后端启动中...")

    # 初始化 Redis（连接失败时打印警告，不阻断启动）
    try:
        await init_redis()
        print("✅ Redis 连接成功")
    except Exception as e:
        print(f"⚠️  Redis 连接失败（将在请求时重试）：{e}")

    # 初始化数据库（连接失败时打印警告，不阻断启动）
    try:
        await init_db()
        print("✅ 数据库连接成功")
    except Exception as e:
        print(f"⚠️  数据库连接失败（将在请求时重试）：{e}")

    # 启动 Tick 引擎
    await tick_engine.start()

    print("🌆 都市余烬后端已就绪")
    yield

    # 关闭时清理
    await tick_engine.stop()
    await close_redis()
    print("🔌 后端已关闭")


app = FastAPI(
    title="都市余烬 API",
    description="《都市余烬》游戏后端服务",
    version="0.1.0",
    lifespan=lifespan,
)

# ─── CORS 配置 ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 路由注册 ─────────────────────────────────────────────────────
app.include_router(http_router, prefix="/api", tags=["系统"])
app.include_router(ws_router, tags=["WebSocket"])
