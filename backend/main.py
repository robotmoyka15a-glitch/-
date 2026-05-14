"""
WashControl — точка входа FastAPI
Запускает HTTP API, Telegram бота, планировщик задач
"""

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Добавляем корень проекта в sys.path для корректных импортов
ROOT = Path(__file__).parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.database import init_db
from backend.config import API_HOST, API_PORT, LOG_FILE, LOG_LEVEL
from backend.routers import (
    auth, shifts, cars, events, reports,
    cameras, settings_router, ai_router, backups,
)
from backend.routers.auth import require_admin
from backend.services import telegram_bot, scheduler
from backend.middleware import health_check

# ── Логирование ───────────────────────────────────────────────────────────────
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(str(LOG_FILE), encoding="utf-8"),
    ],
)
logger = logging.getLogger("washcontrol")

# ── Версия приложения ─────────────────────────────────────────────────────────
APP_VERSION = "1.0.0"


# ── Lifespan (startup/shutdown) ────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──
    logger.info("WashControl запускается...")

    # Инициализация БД
    init_db()
    logger.info("База данных готова")

    # Запуск Telegram бота в фоне
    try:
        telegram_bot.start_bot()
    except Exception as e:
        logger.warning(f"Telegram бот не запустился: {e}")

    # Запуск планировщика
    try:
        scheduler.start_scheduler()
    except Exception as e:
        logger.warning(f"Планировщик не запустился: {e}")

    logger.info(f"API доступен на http://{API_HOST}:{API_PORT}")
    logger.info("WashControl готов к работе ✓")

    yield

    # ── SHUTDOWN ──
    logger.info("WashControl останавливается...")
    try:
        telegram_bot.stop_bot()
        scheduler.stop_scheduler()
    except Exception:
        pass
    logger.info("WashControl остановлен")


# ── Приложение ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="WashControl API",
    version=APP_VERSION,
    description="Система управления автомойкой «Робот-Мойка»",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# CORS — разрешаем Electron (localhost) обращаться к API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        f"http://127.0.0.1:{API_PORT}",
        "file://",              # Electron production build
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Middleware для rate limiting ──────────────────────────────────────────────
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Middleware для проверки rate limit на все запросы."""
    from backend.middleware import get_remote_address, check_rate_limit
    
    client_ip = get_remote_address(request)
    
    # Строгий лимит для чувствительных эндпоинтов
    sensitive_paths = ["/auth/login", "/auth/change-password"]
    if any(request.url.path.startswith(p) for p in sensitive_paths):
        key = f"{client_ip}:{request.url.path}"
        if check_rate_limit(key, max_requests=10, window_seconds=60):
            return JSONResponse(
                status_code=429,
                content={"detail": "Слишком много запросов. Попробуйте позже."}
            )
    else:
        # Обычный лимит для остальных
        key = f"{client_ip}:global"
        if check_rate_limit(key, max_requests=60, window_seconds=60):
            return JSONResponse(
                status_code=429,
                content={"detail": "Слишком много запросов. Попробуйте позже."}
            )
    
    response = await call_next(request)
    return response

# ── Роутеры ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(shifts.router)
app.include_router(cars.router)
app.include_router(events.router)
app.include_router(reports.router)
app.include_router(cameras.router)
app.include_router(settings_router.router)
app.include_router(ai_router.router)
app.include_router(backups.router)


# ── Системные эндпоинты ───────────────────────────────────────────────────────

@app.get("/", tags=["system"])
def root():
    return {
        "name":    "WashControl",
        "version": APP_VERSION,
        "status":  "running",
    }


@app.get("/api/version", tags=["system"])
def api_version():
    """Возвращает текущую версию API/приложения."""
    return {
        "version": APP_VERSION,
        "name":    "WashControl",
        "brand":   "Робот-Мойка",
    }


@app.get("/health", tags=["system"])
async def health():
    """
    Расширенная проверка здоровья системы.
    Проверяет БД, AI, место на диске.
    """
    return await health_check()


@app.post("/notify/test", tags=["system"])
def test_notify(current_user: dict = Depends(require_admin)):
    """Тест уведомлений — только для администраторов."""
    from backend.services.telegram_bot import notify_admin
    from backend.services.vk_notify import notify
    notify_admin("✅ WashControl: тестовое уведомление Telegram")
    notify("✅ WashControl: тестовое уведомление VK")
    return {"ok": True}


# ── Раздача скриншотов ────────────────────────────────────────────────────────
screenshots_dir = ROOT / "data" / "screenshots"
screenshots_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    "/screenshots",
    StaticFiles(directory=str(screenshots_dir)),
    name="screenshots",
)


# ── Запуск ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=False,
        log_level=LOG_LEVEL.lower(),
        access_log=False,           # уменьшает шум в логах
    )
