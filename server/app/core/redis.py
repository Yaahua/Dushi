import redis.asyncio as aioredis
from app.core.config import settings

# 全局 Redis 连接池（应用启动时初始化）
redis_client: aioredis.Redis | None = None


async def init_redis() -> aioredis.Redis:
    """初始化 Redis 连接池"""
    global redis_client
    redis_client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    # 测试连接
    await redis_client.ping()
    return redis_client


async def close_redis():
    """关闭 Redis 连接"""
    global redis_client
    if redis_client:
        await redis_client.aclose()
        redis_client = None


def get_redis() -> aioredis.Redis:
    """FastAPI 依赖注入：获取 Redis 客户端"""
    if redis_client is None:
        raise RuntimeError("Redis 未初始化，请检查启动流程")
    return redis_client
