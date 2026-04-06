from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # 应用
    APP_ENV: str = "development"
    SECRET_KEY: str = "change_me_in_production"

    # 数据库
    DATABASE_URL: str = "postgresql+asyncpg://dushi:dushi_secret@localhost:5432/dushi_game"

    # Redis
    REDIS_URL: str = "redis://:dushi_redis_secret@localhost:6379/0"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
