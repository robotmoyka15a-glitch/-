"""
WashControl — конфигурация приложения
Все пути, константы и параметры загружаются отсюда
"""

from pathlib import Path
import os

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
SECRET_KEY          = os.getenv("WASHCONTROL_SECRET", "washcontrol-secret-change-me")
JWT_ALGORITHM       = "HS256"
ACCESS_TOKEN_EXPIRE = 60 * 12      # 12 часов в минутах

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
