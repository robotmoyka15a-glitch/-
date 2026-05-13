"""
WashControl — роутер смен
Открытие/закрытие смены, история, опоздания
"""

import logging
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.database import get_connection, get_setting
from backend.config import DEFAULT_SHIFT_START
from backend.routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/shifts", tags=["shifts"])
logger = logging.getLogger("washcontrol.shifts")


# ── Pydantic схемы ────────────────────────────────────────────────────────────

class ShiftOut(BaseModel):
    id: int
    user_id: int
    username: Optional[str] = None
    full_name: Optional[str] = None
    date: str
    started_at: str
    ended_at: Optional[str]
    is_late: int
    late_minutes: int
    note: Optional[str]
    car_count: Optional[int] = 0
    total_amount: Optional[float] = 0.0


class ShiftNote(BaseModel):
    note: str


# ── Утилиты ───────────────────────────────────────────────────────────────────

def _calc_late(started_at_str: str, shift_start: str) -> tuple[int, int]:
    """
    Возвращает (is_late: 0|1, late_minutes: int).
    Порог опоздания читается из БД через get_setting().
    """
    try:
        threshold = int(get_setting("late_threshold_min", "15"))
        started = datetime.fromisoformat(started_at_str)
        today = started.date().isoformat()
        expected = datetime.fromisoformat(f"{today}T{shift_start}:00")
        diff = int((started - expected).total_seconds() / 60)
        if diff >= threshold:
            return 1, diff
        return 0, max(0, diff)
    except Exception:
        return 0, 0


def _enrich(row: dict) -> dict:
    """
    Добавляет username, full_name, car_count, total_amount к смене.
    Использует один JOIN-запрос вместо нескольких отдельных.
    """
    conn = get_connection()
    enriched = conn.execute(
        """SELECT
               u.username,
               u.full_name,
               COUNT(c.id)                                  AS car_count,
               COALESCE(SUM(c.amount + c.extra_amount), 0)  AS total_amount
           FROM shifts s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN cars c ON c.shift_id = s.id
           WHERE s.id = ?
           GROUP BY s.id""",
        (row["id"],),
    ).fetchone()

    result = dict(row)
    if enriched:
        result["username"]     = enriched["username"]
        result["full_name"]    = enriched["full_name"]
        result["car_count"]    = enriched["car_count"]
        result["total_amount"] = enriched["total_amount"]
    else:
        result.setdefault("username", None)
        result.setdefault("full_name", None)
        result.setdefault("car_count", 0)
        result.setdefault("total_amount", 0.0)
    return result


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@router.post("/start", response_model=ShiftOut)
def start_shift(
    body: ShiftNote = ShiftNote(note=""),
    current_user: dict = Depends(get_current_user)
):
    """Оператор открывает смену. Нельзя открыть дважды в один день."""
    today = date.today().isoformat()
    conn = get_connection()

    # Проверка: уже есть открытая смена сегодня
    existing = conn.execute(
        "SELECT id FROM shifts WHERE user_id = ? AND date = ? AND ended_at IS NULL",
        (current_user["id"], today)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Смена уже открыта")

    now_str = datetime.now().isoformat(timespec="seconds")

    # Читаем время начала смены из БД
    shift_start_row = conn.execute(
        "SELECT value FROM settings WHERE key = 'shift_start_time'"
    ).fetchone()
    start_time = shift_start_row["value"] if shift_start_row else DEFAULT_SHIFT_START

    is_late, late_min = _calc_late(now_str, start_time)

    cur = conn.execute(
        """INSERT INTO shifts (user_id, date, started_at, is_late, late_minutes, note)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (current_user["id"], today, now_str, is_late, late_min, body.note)
    )
    shift_id = cur.lastrowid

    # Событие в журнал
    late_text = f" (опоздание {late_min} мин)" if is_late else ""
    conn.execute(
        """INSERT INTO events (user_id, shift_id, event_type, title, body, source)
           VALUES (?, ?, 'shift_start', ?, ?, 'app')""",
        (current_user["id"], shift_id,
         f"Смена открыта — {current_user['full_name']}",
         f"Начало: {now_str}{late_text}")
    )
    conn.commit()

    row = conn.execute("SELECT * FROM shifts WHERE id = ?", (shift_id,)).fetchone()
    result = ShiftOut(**_enrich(dict(row)))

    # ── Уведомления (telegram + vk) ──────────────────────────────────────────
    msg = (
        f"🟢 Смена открыта\n"
        f"Оператор: {current_user['full_name']}\n"
        f"Время: {now_str}{late_text}"
    )
    try:
        from backend.services.telegram_bot import notify_admin
        notify_admin(msg)
    except Exception as e:
        logger.warning(f"Telegram уведомление не отправлено: {e}")

    try:
        from backend.services.vk_notify import notify
        notify(msg)
    except Exception as e:
        logger.warning(f"VK уведомление не отправлено: {e}")

    return result


@router.post("/end", response_model=ShiftOut)
def end_shift(
    body: ShiftNote = ShiftNote(note=""),
    current_user: dict = Depends(get_current_user)
):
    """Оператор закрывает свою текущую смену."""
    today = date.today().isoformat()
    conn = get_connection()

    shift = conn.execute(
        "SELECT * FROM shifts WHERE user_id = ? AND date = ? AND ended_at IS NULL",
        (current_user["id"], today)
    ).fetchone()
    if not shift:
        raise HTTPException(status_code=404, detail="Открытая смена не найдена")

    now_str = datetime.now().isoformat(timespec="seconds")
    conn.execute(
        "UPDATE shifts SET ended_at = ?, note = COALESCE(NULLIF(?,''), note) WHERE id = ?",
        (now_str, body.note, shift["id"])
    )
    conn.execute(
        """INSERT INTO events (user_id, shift_id, event_type, title, body, source)
           VALUES (?, ?, 'shift_end', ?, ?, 'app')""",
        (current_user["id"], shift["id"],
         f"Смена закрыта — {current_user['full_name']}",
         f"Конец: {now_str}")
    )
    conn.commit()
    row = conn.execute("SELECT * FROM shifts WHERE id = ?", (shift["id"],)).fetchone()
    return ShiftOut(**_enrich(dict(row)))


@router.get("/active")
def get_active_shift(current_user: dict = Depends(get_current_user)):
    """Возвращает текущую открытую смену пользователя (или null)."""
    today = date.today().isoformat()
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM shifts WHERE user_id = ? AND date = ? AND ended_at IS NULL",
        (current_user["id"], today)
    ).fetchone()
    if not row:
        return None
    return ShiftOut(**_enrich(dict(row)))


@router.get("/today")
def get_today_shifts(current_user: dict = Depends(get_current_user)):
    """Все смены за сегодня — оператор видит только свои, admin — все."""
    today = date.today().isoformat()
    conn = get_connection()
    if current_user["role"] == "admin":
        rows = conn.execute(
            "SELECT * FROM shifts WHERE date = ? ORDER BY started_at DESC", (today,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM shifts WHERE user_id = ? AND date = ? ORDER BY started_at DESC",
            (current_user["id"], today)
        ).fetchall()
    return [ShiftOut(**_enrich(dict(r))) for r in rows]


@router.get("/history")
def get_shift_history(
    limit: int = 30,
    offset: int = 0,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """История смен. Оператор видит только свои."""
    conn = get_connection()
    params: list = []
    where_clauses = []

    if current_user["role"] != "admin":
        where_clauses.append("s.user_id = ?")
        params.append(current_user["id"])
    if date_from:
        where_clauses.append("s.date >= ?")
        params.append(date_from)
    if date_to:
        where_clauses.append("s.date <= ?")
        params.append(date_to)

    where = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    params += [limit, offset]

    rows = conn.execute(
        f"SELECT * FROM shifts s {where} ORDER BY s.started_at DESC LIMIT ? OFFSET ?",
        params
    ).fetchall()
    return [ShiftOut(**_enrich(dict(r))) for r in rows]


@router.get("/{shift_id}", response_model=ShiftOut)
def get_shift(shift_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    row = conn.execute("SELECT * FROM shifts WHERE id = ?", (shift_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Смена не найдена")
    if current_user["role"] != "admin" and row["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return ShiftOut(**_enrich(dict(row)))
