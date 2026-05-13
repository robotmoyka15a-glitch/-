"""
WashControl — AI роутер
HTTP эндпоинты для AI-запросов из интерфейса
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from backend.routers.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    available: bool


@router.get("/status")
def ai_status(current_user: dict = Depends(get_current_user)):
    """Проверить доступность AI."""
    from backend.services.ai_worker import is_available
    return {"available": is_available()}


@router.post("/ask", response_model=AskResponse)
def ask(body: AskRequest, current_user: dict = Depends(get_current_user)):
    """Задать вопрос AI-помощнику."""
    from backend.services.ai_worker import ask_ai, is_available
    answer = ask_ai(body.question, source="app")
    return AskResponse(answer=answer, available=is_available())


@router.get("/summary")
def daily_summary(current_user: dict = Depends(get_current_user)):
    """Получить AI-сводку за сегодня."""
    from backend.services.ai_worker import generate_daily_summary
    return {"summary": generate_daily_summary()}


@router.get("/history")
def ai_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """История AI-запросов."""
    from backend.database import get_connection
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM ai_history ORDER BY created_at DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
