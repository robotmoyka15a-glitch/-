"""
WashControl — Rate Limiting и Input Validation
Защита от DDoS, злоупотреблений и некорректных данных
Используем fastapi-limiter вместо slowapi
"""

from fastapi import Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
import re
import time
from typing import Dict


# ── Rate Limiter Storage (in-memory для простоты) ─────────────────────────────

_rate_limit_storage: Dict[str, list] = {}


def get_remote_address(request: Request) -> str:
    """Получает IP адрес клиента."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(key: str, max_requests: int, window_seconds: int = 60) -> bool:
    """
    Проверяет лимит запросов.
    Возвращает True если лимит превышен.
    """
    now = time.time()
    current_time = now - window_seconds
    
    if key not in _rate_limit_storage:
        _rate_limit_storage[key] = []
    
    # Удаляем старые записи
    _rate_limit_storage[key] = [t for t in _rate_limit_storage[key] if t > current_time]
    
    # Проверяем лимит
    if len(_rate_limit_storage[key]) >= max_requests:
        return True  # Лимит превышен
    
    # Добавляем текущий запрос
    _rate_limit_storage[key].append(now)
    return False  # Всё ок


# ── Dependency для rate limiting ──────────────────────────────────────────────

async def rate_limit_dependency(
    request: Request,
    max_requests: int = 60,
    window_seconds: int = 60
):
    """Dependency для проверки rate limit."""
    client_ip = get_remote_address(request)
    key = f"{client_ip}:{request.url.path}"
    
    if check_rate_limit(key, max_requests, window_seconds):
        raise HTTPException(
            status_code=429,
            detail="Слишком много запросов. Попробуйте позже."
        )


def rate_limit_strict(max_requests: int = 10, window_seconds: int = 60):
    """Декоратор для строгого rate limiting чувствительных эндпоинтов."""
    async def dependency(request: Request):
        client_ip = get_remote_address(request)
        key = f"{client_ip}:{request.url.path}"
        
        if check_rate_limit(key, max_requests, window_seconds):
            raise HTTPException(
                status_code=429,
                detail="Слишком много запросов. Попробуйте позже."
            )
    
    return Depends(dependency)


# ── Pydantic Validators ───────────────────────────────────────────────────────

def validate_username(value: str) -> str:
    """Валидация имени пользователя: 3-32 символа, буквы/цифры/подчёркивание."""
    if not value or len(value) < 3 or len(value) > 32:
        raise ValueError("Имя пользователя должно быть от 3 до 32 символов")
    if not re.match(r"^[a-zA-Zа-яА-ЯёЁ0-9_]+$", value):
        raise ValueError("Имя пользователя может содержать только буквы, цифры и подчёркивание")
    return value


def validate_password(value: str) -> str:
    """Валидация пароля: минимум 4 символа."""
    if not value or len(value) < 4:
        raise ValueError("Пароль должен быть минимум 4 символа")
    return value


def validate_full_name(value: str) -> str:
    """Валидация полного имени: 2-64 символа."""
    if not value or len(value) < 2 or len(value) > 64:
        raise ValueError("Имя должно быть от 2 до 64 символов")
    return value


def validate_phone(value: str | None) -> str | None:
    """Валидация телефона: +7XXX-XXX-XX-XX или XXX-XXX-XX-XX."""
    if not value:
        return value
    cleaned = re.sub(r"[^\d+]", "", value)
    if len(cleaned) < 10 or len(cleaned) > 15:
        raise ValueError("Неверный формат телефона")
    return value


def validate_amount(value: float) -> float:
    """Валидация суммы: от 0 до 1 000 000."""
    if value < 0 or value > 1_000_000:
        raise ValueError("Сумма должна быть от 0 до 1 000 000")
    return value


# ── Общие Pydantic базовые классы ─────────────────────────────────────────────

class BaseRequest(BaseModel):
    """Базовый класс для всех запросов с общей валидацией."""
    
    class Config:
        extra = "forbid"  # Запрещаем лишние поля


# ── Health Check Endpoint ─────────────────────────────────────────────────────

async def health_check() -> dict:
    """
    Расширенная проверка здоровья системы.
    Проверяет БД, AI, интеграции.
    """
    from backend.database import get_connection
    
    result = {
        "status": "ok",
        "checks": {},
    }
    
    # Проверка БД
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        result["checks"]["database"] = "ok"
    except Exception as e:
        result["checks"]["database"] = f"error: {e}"
        result["status"] = "degraded"
    
    # Проверка AI
    try:
        from backend.services.ai_worker import is_available
        ai_status = "available" if is_available() else "unavailable"
        result["checks"]["ai"] = ai_status
    except Exception as e:
        result["checks"]["ai"] = f"error: {e}"
    
    # Проверка места на диске
    try:
        import shutil
        total, used, free = shutil.disk_usage("/")
        free_gb = free / (1024 ** 3)
        if free_gb < 1:
            result["checks"]["disk"] = f"warning: {free_gb:.2f} GB free"
            result["status"] = "warning"
        else:
            result["checks"]["disk"] = f"ok: {free_gb:.2f} GB free"
    except Exception as e:
        result["checks"]["disk"] = f"error: {e}"
    
    return result
