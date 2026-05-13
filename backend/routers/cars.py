"""
WashControl — роутер журнала машин
Добавление, просмотр, редактирование записей о помытых машинах
"""

import logging
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.database import get_connection
from backend.config import WASH_MODES, PAYMENT_METHODS
from backend.routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/cars", tags=["cars"])
logger = logging.getLogger("washcontrol.cars")


# ── Pydantic схемы ────────────────────────────────────────────────────────────

class CarCreate(BaseModel):
    arrived_at: Optional[str] = None        # если не указано — текущее время
    wash_mode: int                           # 1–4
    payment_method: str                     # cash | card | qr
    amount: float
    extra_service: int = 0                  # 0 или 1
    extra_service_name: Optional[str] = None
    extra_payment: Optional[str] = None     # cash | card | qr
    extra_amount: float = 0.0
    windows_wiped: int = 0                  # 0 или 1
    note: Optional[str] = None


class CarOut(BaseModel):
    id: int
    shift_id: int
    user_id: int
    full_name: Optional[str] = None
    arrived_at: str
    wash_mode: int
    wash_mode_name: str
    payment_method: str
    payment_method_name: str
    amount: float
    extra_service: int
    extra_service_name: Optional[str]
    extra_payment: Optional[str]
    extra_amount: float
    windows_wiped: int
    note: Optional[str]
    created_at: str
    car_number: Optional[int] = None        # порядковый номер в смене


class CarUpdate(BaseModel):
    wash_mode: Optional[int] = None
    payment_method: Optional[str] = None
    amount: Optional[float] = None
    extra_service: Optional[int] = None
    extra_service_name: Optional[str] = None
    extra_payment: Optional[str] = None
    extra_amount: Optional[float] = None
    windows_wiped: Optional[int] = None
    note: Optional[str] = None


# ── Утилиты ───────────────────────────────────────────────────────────────────

def _enrich_car(row: dict) -> dict:
    """
    Добавляет full_name, wash_mode_name, payment_method_name, car_number.
    Использует один JOIN-запрос вместо нескольких отдельных.
    """
    conn = get_connection()
    enriched = conn.execute(
        """SELECT
               u.full_name,
               (SELECT COUNT(*) FROM cars c2
                WHERE c2.shift_id = c.shift_id AND c2.id <= c.id) AS car_number
           FROM cars c
           JOIN users u ON u.id = c.user_id
           WHERE c.id = ?""",
        (row["id"],),
    ).fetchone()

    result = dict(row)
    if enriched:
        result["full_name"]  = enriched["full_name"]
        result["car_number"] = enriched["car_number"]
    else:
        result.setdefault("full_name", "")
        result.setdefault("car_number", 0)

    result["wash_mode_name"]      = WASH_MODES.get(row["wash_mode"], "?")
    result["payment_method_name"] = PAYMENT_METHODS.get(row["payment_method"], "?")
    return result


def _get_active_shift(user_id: int):
    """Возвращает текущую открытую смену пользователя или None."""
    today = date.today().isoformat()
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM shifts WHERE user_id = ? AND date = ? AND ended_at IS NULL",
        (user_id, today)
    ).fetchone()
    return dict(row) if row else None


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@router.post("", response_model=CarOut)
def add_car(body: CarCreate, current_user: dict = Depends(get_current_user)):
    """Добавить машину в текущую смену оператора."""
    shift = _get_active_shift(current_user["id"])
    if not shift:
        raise HTTPException(status_code=400, detail="Нет открытой смены")

    if body.wash_mode not in WASH_MODES:
        raise HTTPException(status_code=400, detail="Неверный режим мойки (1–4)")
    if body.payment_method not in PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail="Неверный способ оплаты")

    arrived = body.arrived_at or datetime.now().isoformat(timespec="seconds")

    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO cars
           (shift_id, user_id, arrived_at, wash_mode, payment_method, amount,
            extra_service, extra_service_name, extra_payment, extra_amount,
            windows_wiped, note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            shift["id"], current_user["id"], arrived,
            body.wash_mode, body.payment_method, body.amount,
            body.extra_service, body.extra_service_name,
            body.extra_payment, body.extra_amount,
            body.windows_wiped, body.note,
        )
    )
    car_id = cur.lastrowid

    # Считаем номер машины в смене
    car_num = conn.execute(
        "SELECT COUNT(*) as n FROM cars WHERE shift_id = ?", (shift["id"],)
    ).fetchone()["n"]

    mode_name = WASH_MODES.get(body.wash_mode, "")
    pay_name  = PAYMENT_METHODS.get(body.payment_method, "")
    extra_txt = f", доп.услуга: {body.extra_service_name}" if body.extra_service else ""
    wiped_txt = " ✓ стёкла" if body.windows_wiped else ""

    conn.execute(
        """INSERT INTO events (user_id, shift_id, event_type, title, body, source)
           VALUES (?, ?, 'car_added', ?, ?, 'app')""",
        (
            current_user["id"], shift["id"],
            f"Машина #{car_num} — {mode_name}",
            f"Приезд: {arrived} | {mode_name} | {pay_name} {body.amount}₽"
            f"{extra_txt}{wiped_txt}",
        )
    )
    conn.commit()

    row = conn.execute("SELECT * FROM cars WHERE id = ?", (car_id,)).fetchone()
    result = CarOut(**_enrich_car(dict(row)))

    # ── Уведомления (telegram + vk) ──────────────────────────────────────────
    msg = (
        f"🚗 Новая машина #{car_num}\n"
        f"Оператор: {current_user['full_name']}\n"
        f"Режим: {mode_name} | Оплата: {pay_name} {body.amount}₽"
        f"{extra_txt}{wiped_txt}"
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


@router.get("/today", response_model=list[CarOut])
def get_today_cars(current_user: dict = Depends(get_current_user)):
    """Все машины за сегодня."""
    today = date.today().isoformat()
    conn = get_connection()
    if current_user["role"] == "admin":
        rows = conn.execute(
            """SELECT c.* FROM cars c
               JOIN shifts s ON c.shift_id = s.id
               WHERE s.date = ? ORDER BY c.arrived_at""",
            (today,)
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT c.* FROM cars c
               JOIN shifts s ON c.shift_id = s.id
               WHERE s.date = ? AND s.user_id = ? ORDER BY c.arrived_at""",
            (today, current_user["id"])
        ).fetchall()
    return [CarOut(**_enrich_car(dict(r))) for r in rows]


@router.get("/shift/{shift_id}", response_model=list[CarOut])
def get_cars_by_shift(shift_id: int, current_user: dict = Depends(get_current_user)):
    """Все машины конкретной смены."""
    conn = get_connection()
    shift = conn.execute("SELECT * FROM shifts WHERE id = ?", (shift_id,)).fetchone()
    if not shift:
        raise HTTPException(status_code=404, detail="Смена не найдена")
    if current_user["role"] != "admin" and shift["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    rows = conn.execute(
        "SELECT * FROM cars WHERE shift_id = ? ORDER BY arrived_at",
        (shift_id,)
    ).fetchall()
    return [CarOut(**_enrich_car(dict(r))) for r in rows]


@router.put("/{car_id}", response_model=CarOut)
def update_car(
    car_id: int,
    body: CarUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Редактировать запись о машине (только своя или admin)."""
    conn = get_connection()
    car = conn.execute("SELECT * FROM cars WHERE id = ?", (car_id,)).fetchone()
    if not car:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if current_user["role"] != "admin" and car["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Доступ запрещён")

    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        conn.execute(
            f"UPDATE cars SET {set_clause} WHERE id = ?",
            list(fields.values()) + [car_id]
        )
        conn.commit()

    row = conn.execute("SELECT * FROM cars WHERE id = ?", (car_id,)).fetchone()
    return CarOut(**_enrich_car(dict(row)))


@router.delete("/{car_id}")
def delete_car(car_id: int, current_user: dict = Depends(require_admin)):
    """Удалить запись о машине — только admin."""
    conn = get_connection()
    conn.execute("DELETE FROM cars WHERE id = ?", (car_id,))
    conn.commit()
    return {"ok": True}


@router.get("/stats/today")
def today_stats(current_user: dict = Depends(get_current_user)):
    """Сводная статистика за сегодня."""
    today = date.today().isoformat()
    conn = get_connection()
    stats = conn.execute(
        """SELECT
               COUNT(*) as total_cars,
               COALESCE(SUM(amount), 0) as total_main,
               COALESCE(SUM(extra_amount), 0) as total_extra,
               COALESCE(SUM(amount + extra_amount), 0) as total_revenue,
               SUM(CASE WHEN windows_wiped = 1 THEN 1 ELSE 0 END) as wiped_count,
               SUM(CASE WHEN extra_service = 1 THEN 1 ELSE 0 END) as extra_count
           FROM cars c
           JOIN shifts s ON c.shift_id = s.id
           WHERE s.date = ?""",
        (today,)
    ).fetchone()

    by_mode = conn.execute(
        """SELECT wash_mode, COUNT(*) as cnt,
               COALESCE(SUM(amount), 0) as revenue
           FROM cars c
           JOIN shifts s ON c.shift_id = s.id
           WHERE s.date = ?
           GROUP BY wash_mode ORDER BY wash_mode""",
        (today,)
    ).fetchall()

    by_payment = conn.execute(
        """SELECT payment_method, COUNT(*) as cnt,
               COALESCE(SUM(amount), 0) as revenue
           FROM cars c
           JOIN shifts s ON c.shift_id = s.id
           WHERE s.date = ?
           GROUP BY payment_method""",
        (today,)
    ).fetchall()

    return {
        "summary":    dict(stats),
        "by_mode":    [dict(r) for r in by_mode],
        "by_payment": [dict(r) for r in by_payment],
        "mode_names": WASH_MODES,
        "payment_names": PAYMENT_METHODS,
    }
