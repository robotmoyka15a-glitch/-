"""
WashControl — VK уведомления
Отправка сообщений в личку и в группу через VK API
"""

import logging
import httpx
from typing import Optional

logger = logging.getLogger("washcontrol.vk")

VK_API_VERSION = "5.199"
VK_API_BASE    = "https://api.vk.com/method"


def _get_cfg() -> dict:
    """Читает настройки VK из БД."""
    from backend.database import get_setting
    return {
        "token":    get_setting("vk_token"),
        "owner_id": get_setting("vk_owner_id"),   # личка владельца (user_id)
        "group_id": get_setting("vk_group_id"),   # стена группы (отриц. число)
    }


def _vk_call(method: str, params: dict) -> dict:
    """Выполнить запрос к VK API."""
    cfg = _get_cfg()
    if not cfg["token"]:
        return {"error": "VK token не настроен"}

    all_params = {
        "access_token": cfg["token"],
        "v":            VK_API_VERSION,
        **params,
    }
    try:
        r = httpx.post(
            f"{VK_API_BASE}/{method}",
            data=all_params,
            timeout=10,
        )
        return r.json()
    except Exception as e:
        logger.warning(f"VK API call failed ({method}): {e}")
        return {"error": str(e)}


def send_to_owner(text: str) -> bool:
    """Отправить личное сообщение владельцу."""
    cfg = _get_cfg()
    if not cfg["owner_id"]:
        return False
    import random
    result = _vk_call("messages.send", {
        "user_id":   cfg["owner_id"],
        "message":   text,
        "random_id": random.randint(1, 2**31),
    })
    ok = "response" in result
    if not ok:
        logger.warning(f"VK send_to_owner failed: {result}")
    return ok


def post_to_group(text: str) -> bool:
    """Опубликовать сообщение на стене группы."""
    cfg = _get_cfg()
    if not cfg["group_id"]:
        return False
    # owner_id для группы — отрицательный ID группы
    group_id = cfg["group_id"]
    if not group_id.startswith("-"):
        group_id = f"-{group_id}"

    result = _vk_call("wall.post", {
        "owner_id":       group_id,
        "message":        text,
        "from_group":     1,
        "close_comments": 1,
    })
    ok = "response" in result
    if not ok:
        logger.warning(f"VK post_to_group failed: {result}")
    return ok


def notify(text: str, to_owner: bool = True, to_group: bool = True) -> dict:
    """
    Отправить уведомление в VK.
    to_owner=True → личное сообщение владельцу
    to_group=True → пост на стену группы
    """
    results = {}
    if to_owner:
        results["owner"] = send_to_owner(text)
    if to_group:
        results["group"] = post_to_group(text)
    return results


def send_shift_start(operator_name: str, time_str: str, is_late: bool,
                     late_min: int = 0):
    """Уведомление о начале смены."""
    late_txt = f"\n⚠️ Опоздание на {late_min} мин." if is_late else ""
    text = (
        f"✅ Смена началась\n"
        f"Оператор: {operator_name}\n"
        f"Время: {time_str}{late_txt}"
    )
    notify(text)


def send_shift_end(operator_name: str, time_str: str,
                   car_count: int, revenue: float):
    text = (
        f"🏁 Смена завершена\n"
        f"Оператор: {operator_name}\n"
        f"Время: {time_str}\n"
        f"Машин: {car_count}\n"
        f"Выручка: {revenue:.0f} ₽"
    )
    notify(text)


def send_new_car(car_number: int, mode_name: str, pay_name: str,
                 amount: float, extra: bool):
    extra_txt = " + доп. услуга" if extra else ""
    text = (
        f"🚗 Машина #{car_number}\n"
        f"Режим: {mode_name}\n"
        f"Оплата: {pay_name} {amount:.0f} ₽{extra_txt}"
    )
    notify(text, to_owner=False, to_group=True)   # в группу, не в личку


def send_late_alert(operator_name: str, late_min: int):
    text = (
        f"⚠️ Опоздание!\n"
        f"Оператор {operator_name} опоздал на {late_min} мин."
    )
    notify(text, to_owner=True, to_group=False)   # только владельцу


def send_daily_report(report_text: str):
    """Отправить ежедневный отчёт."""
    notify(f"📊 Ежедневный отчёт\n\n{report_text}")
