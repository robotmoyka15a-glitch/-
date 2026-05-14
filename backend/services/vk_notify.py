"""
WashControl — VK уведомления
Отправка сообщений в личку и в группу через VK API
С retry logic, circuit breaker и rate limiting
"""

import logging
import httpx
import time
import random
from typing import Optional
from functools import wraps

logger = logging.getLogger("washcontrol.vk")

VK_API_VERSION = "5.199"
VK_API_BASE    = "https://api.vk.com/method"

# ── Circuit Breaker ───────────────────────────────────────────────────────────

class CircuitBreaker:
    """
    Circuit Breaker для защиты от постоянных ошибок VK API.
    После N неудач — перестаёт пытаться на M секунд.
    """
    
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.last_failure_time = 0
        self.state = "closed"  # closed → open → half-open
    
    def call(self, func, *args, **kwargs):
        if self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                logger.info("Circuit breaker: переход в half-open состояние")
                self.state = "half-open"
            else:
                logger.warning("Circuit breaker: VK API недоступен (open state)")
                return {"error": "Circuit breaker open", "circuit_breaker": True}
        
        try:
            result = func(*args, **kwargs)
            if self.state == "half-open":
                logger.info("Circuit breaker: успех, возврат в closed")
                self.state = "closed"
                self.failures = 0
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.failures >= self.failure_threshold:
                logger.warning(f"Circuit breaker: {self.failures} неудач, переход в open")
                self.state = "open"
            raise


# Глобальный circuit breaker для VK
_vk_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)


# ── Retry Decorator ───────────────────────────────────────────────────────────

def retry_on_failure(max_attempts=3, backoff_seconds=2):
    """
    Декоратор для автоматического retry при ошибках сети.
    Использует экспоненциальную задержку между попытками.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
                    last_exception = e
                    if attempt < max_attempts:
                        delay = backoff_seconds * (2 ** (attempt - 1))
                        logger.warning(
                            f"{func.__name__}: попытка {attempt} не удалась, "
                            f"ждем {delay}s перед следующей..."
                        )
                        time.sleep(delay)
                    else:
                        logger.error(f"{func.__name__}: все {max_attempts} попытки исчерпаны")
                except Exception as e:
                    # Не сетевые ошибки не retry'им
                    logger.warning(f"{func.__name__}: ошибка {e}")
                    raise
            
            if last_exception:
                raise last_exception
            return None
        return wrapper
    return decorator


# ── Rate Limiter для VK API ───────────────────────────────────────────────────

class RateLimiter:
    """Простой rate limiter для VK API (не более N запросов в секунду)."""
    
    def __init__(self, calls_per_second=3):
        self.min_interval = 1.0 / calls_per_second
        self.last_call_time = 0
    
    def wait_if_needed(self):
        now = time.time()
        elapsed = now - self.last_call_time
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            time.sleep(sleep_time)
        self.last_call_time = time.time()


_vk_rate_limiter = RateLimiter(calls_per_second=3)


# ── Основные функции ──────────────────────────────────────────────────────────

def _get_cfg() -> dict:
    """Читает настройки VK из БД."""
    from backend.database import get_setting
    return {
        "token":    get_setting("vk_token"),
        "owner_id": get_setting("vk_owner_id"),   # личка владельца (user_id)
        "group_id": get_setting("vk_group_id"),   # стена группы (отриц. число)
    }


@retry_on_failure(max_attempts=3, backoff_seconds=2)
def _vk_call(method: str, params: dict) -> dict:
    """Выполнить запрос к VK API с retry и circuit breaker."""
    cfg = _get_cfg()
    if not cfg["token"]:
        return {"error": "VK token не настроен"}
    
    # Ждём если нужно (rate limiting)
    _vk_rate_limiter.wait_if_needed()
    
    all_params = {
        "access_token": cfg["token"],
        "v":            VK_API_VERSION,
        **params,
    }
    
    def _do_request():
        r = httpx.post(
            f"{VK_API_BASE}/{method}",
            data=all_params,
            timeout=10,
        )
        r.raise_for_status()  # Вызовет exception при 4xx/5xx
        return r.json()
    
    # Используем circuit breaker
    return _vk_circuit_breaker.call(_do_request)


def send_to_owner(text: str) -> bool:
    """Отправить личное сообщение владельцу."""
    cfg = _get_cfg()
    if not cfg["owner_id"]:
        return False
    
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
