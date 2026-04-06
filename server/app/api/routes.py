from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.redis import get_redis
import redis.asyncio as aioredis

router = APIRouter()


@router.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
    cache: aioredis.Redis = Depends(get_redis),
):
    """
    健康检查接口：验证数据库与 Redis 连接是否正常。
    审查节点：制作人可通过访问 /health 确认后端基础设施运行状态。
    """
    # 测试数据库连接
    try:
        await db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    # 测试 Redis 连接
    try:
        await cache.ping()
        redis_status = "ok"
    except Exception as e:
        redis_status = f"error: {e}"

    return {
        "status": "ok" if db_status == "ok" and redis_status == "ok" else "degraded",
        "database": db_status,
        "redis": redis_status,
    }
