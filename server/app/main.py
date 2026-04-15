from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import router as http_router
from app.api.websocket import router as ws_router, manager as ws_manager, session_mgr
from app.engine.tick import TickEngine

# ─── 软依赖：数据库（无 SQLAlchemy 时跳过）──────────────────────────
try:
    from app.core.database import init_db as _init_db
    _HAS_DB = True
except (ImportError, ModuleNotFoundError):
    _HAS_DB = False
    async def _init_db():  # type: ignore
        pass

# ─── 软依赖：Redis（无 redis 包时跳过）──────────────────────────────
try:
    from app.core.redis import init_redis as _init_redis, close_redis as _close_redis
    _HAS_REDIS = True
except (ImportError, ModuleNotFoundError):
    _HAS_REDIS = False
    async def _init_redis():  # type: ignore
        pass
    async def _close_redis():  # type: ignore
        pass

# 全局 Tick 引擎实例
tick_engine = TickEngine(ws_manager=ws_manager, session_mgr=session_mgr)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化连接，关闭时释放资源"""
    print("🚀 都市余烬后端启动中...")

    # 初始化 Redis（连接失败时打印警告，不阻断启动）
    if _HAS_REDIS:
        try:
            await _init_redis()
            print("✅ Redis 连接成功")
        except Exception as e:
            print(f"⚠️  Redis 连接失败（内存模式运行）：{e}")
    else:
        print("ℹ️  Redis 未安装，跳过（内存模式）")

    # 初始化数据库（连接失败时打印警告，不阻断启动）
    if _HAS_DB:
        try:
            await _init_db()
            print("✅ 数据库连接成功")
        except Exception as e:
            print(f"⚠️  数据库连接失败（内存模式运行）：{e}")
    else:
        print("ℹ️  SQLAlchemy 未安装，跳过（内存模式）")

    # 启动 Tick 引擎
    await tick_engine.start()

    print("🌆 都市余烬后端已就绪")
    yield

    # 关闭时清理
    await tick_engine.stop()
    if _HAS_REDIS:
        await _close_redis()
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
