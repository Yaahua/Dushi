FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app/ ./app/

# 启动命令（不使用 --reload，避免热重载时 WebSocket 路由 404）
# 开发时代码变更请使用 docker-compose restart api 或 docker-compose up --build
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
