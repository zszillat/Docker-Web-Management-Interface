# Build the frontend assets
FROM node:20-bookworm AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Runtime image with Python backend and Docker CLI
FROM python:3.11-slim-bookworm AS backend
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends docker.io docker-compose-plugin ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /frontend/dist ./backend/app/static

WORKDIR /app/backend
EXPOSE 8000

ENV STACK_ROOT=/mnt/storage/yaml \
    APP_CONFIG=/app/backend/app/config.json

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
