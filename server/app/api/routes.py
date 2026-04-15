from fastapi import APIRouter

router = APIRouter()

# ── 软依赖：数据库 ────────────────────────────────────────────────
try:
    import sqlalchemy as _sa
    from app.core.database import AsyncSessionLocal as _AsyncSessionLocal
    _HAS_DB = True
except (ImportError, ModuleNotFoundError):
    _HAS_DB = False

# ── 软依赖： Redis ────────────────────────────────────────────────
try:
    from app.core.redis import get_redis as _get_redis
    _HAS_REDIS = True
except (ImportError, ModuleNotFoundError):
    _HAS_REDIS = False


@router.get("/health")
async def health_check():
    """
    健康检查接口：验证后端基础设施运行状态。
    DB/Redis 未安装时返回 skipped 但不崩溃。
    """
    db_status = "skipped"
    redis_status = "skipped"

    if _HAS_DB:
        try:
            async with _AsyncSessionLocal() as session:
                await session.execute(_sa.text("SELECT 1"))
            db_status = "ok"
        except Exception as e:
            db_status = f"error: {e}"

    if _HAS_REDIS:
        try:
            cache = _get_redis()
            await cache.ping()
            redis_status = "ok"
        except Exception as e:
            redis_status = f"error: {e}"

    overall = "ok" if db_status in ("ok", "skipped") and redis_status in ("ok", "skipped") else "degraded"
    return {
        "status": overall,
        "database": db_status,
        "redis": redis_status,
        "mode": "memory" if db_status == "skipped" else "persistent",
    }
