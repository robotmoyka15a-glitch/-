"""
WashControl — конфигурация приложения
Все пути, константы и параметры загружаются отсюда
"""

from pathlib import Path
import os
import secrets

# ── Пути ─────────────────────────────────────────────────────────────────────
BASE_DIR        = Path(__file__).parent.parent          # корень проекта
DATA_DIR        = BASE_DIR / "data"
BACKUP_DIR      = DATA_DIR / "backups"
LOG_DIR         = DATA_DIR / "logs"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"
DB_PATH         = DATA_DIR / "washcontrol.db"
AI_MODELS_DIR   = DATA_DIR / "models"

# Создаём папки если не существуют
for d in [DATA_DIR, BACKUP_DIR, LOG_DIR, SCREENSHOTS_DIR, AI_MODELS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── Брендинг ─────────────────────────────────────────────────────────────────
BRAND_COLOR = "#22c55e"            # зелёный Робот-Мойка
BRAND_BG    = "#111827"            # тёмный фон

# ── Сервер ────────────────────────────────────────────────────────────────────
API_HOST    = os.getenv("WASHCONTROL_HOST", "127.0.0.1")
API_PORT    = int(os.getenv("WASHCONTROL_PORT", "8765"))
API_BASE    = f"http://{API_HOST}:{API_PORT}"

# ── JWT ───────────────────────────────────────────────────────────────────────
# Критическое исправление: генерируем случайный secret при первом запуске
# Если переменная не задана — генерируем и сохраняем в .env файл
def _get_or_create_secret() -> str:
    env_file = BASE_DIR / ".env"
    existing = os.getenv("WASHCONTROL_SECRET")
    if existing:
        return existing
    # Пытаемся прочитать из .env
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("WASHCONTROL_SECRET="):
                    return line.split("=", 1)[1].strip()
    # Генерируем новый и сохраняем
    new_secret = secrets.token_urlsafe(32)
    try:
        if env_file.exists():
            with open(env_file, "r", encoding="utf-8") as f:
                content = f.read()
            if "WASHCONTROL_SECRET=" not in content:
                with open(env_file, "a", encoding="utf-8") as f:
                    f.write(f"\nWASHCONTROL_SECRET={new_secret}\n")
        else:
            with open(env_file, "w", encoding="utf-8") as f:
                f.write(f"WASHCONTROL_SECRET={new_secret}\n")
    except Exception:
        pass  # Не удалось сохранить, используем временный
    return new_secret

SECRET_KEY          = _get_or_create_secret()
JWT_ALGORITHM       = "HS256"
ACCESS_TOKEN_EXPIRE = 60 * 12      # 12 часов в минутах

# ── Rate Limiting ─────────────────────────────────────────────────────────────
RATE_LIMIT_MAX_REQUESTS = 60       # запросов в минуту для обычных эндпоинтов
RATE_LIMIT_STRICT = 10             # запросов в минуту для чувствительных (login)
RATE_LIMIT_WINDOW = 60             # окно в секундах

# ── Смены ─────────────────────────────────────────────────────────────────────
DEFAULT_SHIFT_START = "08:00"
DEFAULT_SHIFT_END   = "23:00"
LATE_THRESHOLD_MIN  = 15           # опоздание > 15 минут

# ── Режимы мойки ──────────────────────────────────────────────────────────────
WASH_MODES = {
    1: "Экспресс",
    2: "Стандарт",
    3: "Комплекс",
    4: "Премиум",
}

# ── Способы оплаты ────────────────────────────────────────────────────────────
PAYMENT_METHODS = {
    "cash": "Наличные",
    "card": "Карта",
    "qr":   "QR-код",
}

# ── Логирование ───────────────────────────────────────────────────────────────
LOG_LEVEL   = os.getenv("WASHCONTROL_LOG_LEVEL", "INFO")
LOG_FILE    = LOG_DIR / "washcontrol.log"

# ── AI ────────────────────────────────────────────────────────────────────────
# Модель: Qwen2.5-3B-Instruct GGUF (3B параметров, ~2.5GB RAM)
# Скачать: https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF
DEFAULT_AI_MODEL = "qwen2.5-3b-instruct-q4_k_m.gguf"
AI_MAX_TOKENS   = 512
AI_TEMPERATURE  = 0.3
AI_CONTEXT_SIZE = 2048             # умеренный контекст для слабого ПК

# ── Бэкап ────────────────────────────────────────────────────────────────────
BACKUP_KEEP_DAYS = 14              # хранить бэкапы 14 дней

# ── Retry Logic ───────────────────────────────────────────────────────────────
MAX_RETRIES = 3                    # максимум попыток для внешних API
RETRY_BACKOFF = 2                  # экспоненциальная задержка (2^attempt сек)
CIRCUIT_BREAKER_THRESHOLD = 5      # неудач до открытия circuit breaker
CIRCUIT_BREAKER_TIMEOUT = 60       # секунд до попытки восстановления
