"""
WashControl — роутер событий / журнала
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.database import get_connection
from backend.routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/events", tags=["events"])


class EventOut(BaseModel):
    id: int
    user_id: Optional[int]
    shift_id: Optional[int]
    full_name: Optional[str] = None
    event_type: str
    title: str
    body: Optional[str]
    source: str
    screenshot: Optional[str]
    created_at: str


class AdminNote(BaseModel):
    title: str
    body: Optional[str] = None


EVENT_TYPE_LABELS = {
    "shift_start":  "Начало смены",
    "shift_end":    "Конец смены",
    "car_added":    "Новая машина",
    "late":         "Опоздание",
    "camera":       "Камера",
    "admin_note":   "Заметка",
    "system":       "Система",
    "ai_query":     "AI-запрос",
}


def _enrich_event(row: dict, conn=None) -> dict:
    """
    Добавляет full_name к событию.
    Принимает опциональное соединение conn — если передано, использует его,
    не открывая новое. Это позволяет избежать лишних соединений при пакетной
    обработке списков событий.
    """
    result = dict(row)
    if not row.get("user_id"):
        result.setdefault("full_name", None)
        return result

    _conn = conn if conn is not None else get_connection()
    user = _conn.execute(
        "SELECT full_name FROM users WHERE id = ?", (row["user_id"],)
    ).fetchone()
    result["full_name"] = user["full_name"] if user else ""
    return result


@router.get("", response_model=list[EventOut])
def get_events(
    limit: int = 100,
    offset: int = 0,
    event_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Журнал событий. Оператор видит только свои события."""
    conn = get_connection()
    clauses = []
    params: list = []

    if current_user["role"] != "admin":
        clauses.append("user_id = ?")
        params.append(current_user["id"])
    if event_type:
        clauses.append("event_type = ?")
        params.append(event_type)
    if date_from:
        clauses.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("created_at <= ?")
        params.append(date_to + "T23:59:59")

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    params += [limit, offset]
    rows = conn.execute(
        f"SELECT * FROM events {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params,
    ).fetchall()
    # Передаём conn в _enrich_event — одно соединение на весь список
    return [EventOut(**_enrich_event(dict(r), conn=conn)) for r in rows]


@router.get("/today", response_model=list[EventOut])
def get_today_events(current_user: dict = Depends(get_current_user)):
    from datetime import date
    today = date.today().isoformat()
    conn = get_connection()
    if current_user["role"] == "admin":
        rows = conn.execute(
            "SELECT * FROM events WHERE created_at >= ? ORDER BY created_at DESC",
            (today,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM events WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC",
            (current_user["id"], today),
        ).fetchall()
    # Передаём conn в _enrich_event — одно соединение на весь список
    return [EventOut(**_enrich_event(dict(r), conn=conn)) for r in rows]


@router.post("/note", response_model=EventOut)
def add_admin_note(body: AdminNote, current_user: dict = Depends(require_admin)):
    """Администратор добавляет заметку в журнал."""
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO events (user_id, event_type, title, body, source)
           VALUES (?, 'admin_note', ?, ?, 'app')""",
        (current_user["id"], body.title, body.body),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM events WHERE id = ?", (cur.lastrowid,)).fetchone()
    return EventOut(**_enrich_event(dict(row), conn=conn))


@router.delete("/{event_id}")
def delete_event(event_id: int, current_user: dict = Depends(require_admin)):
    """Удалить событие — только admin."""
    conn = get_connection()
    conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
    conn.commit()
    return {"ok": True}
