"""
WashControl — схема базы данных SQLite
Все таблицы, модели и инициализация БД
"""

import sqlite3
import hashlib
import os
from datetime import datetime
from pathlib import Path

# Путь к файлу базы данных
DB_PATH = Path(__file__).parent.parent / "data" / "washcontrol.db"


def get_connection() -> sqlite3.Connection:
    """Возвращает подключение к БД с поддержкой Row как dict."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # лучше для многопоточности
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def init_db():
    """Создаёт все таблицы и вставляет дефолтных пользователей."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection()
    cur = conn.cursor()

    # ── Пользователи ──────────────────────────────────────────────────────────
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        username    TEXT    NOT NULL UNIQUE,
        full_name   TEXT    NOT NULL,
        password    TEXT    NOT NULL,
        role        TEXT    NOT NULL DEFAULT 'operator',
        -- 'operator' | 'admin'
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
    """)

    # ── Смены ─────────────────────────────────────────────────────────────────
    cur.execute("""
    CREATE TABLE IF NOT EXISTS shifts (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        date            TEXT    NOT NULL,           -- YYYY-MM-DD
        started_at      TEXT    NOT NULL,           -- datetime
        ended_at        TEXT,                       -- datetime, NULL пока смена открыта
        is_late         INTEGER NOT NULL DEFAULT 0, -- 1 если опоздал
        late_minutes    INTEGER NOT NULL DEFAULT 0,
        note            TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
    """)

    # ── Журнал машин ──────────────────────────────────────────────────────────
    cur.execute("""
    CREATE TABLE IF NOT EXISTS cars (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id        INTEGER NOT NULL REFERENCES shifts(id),
        user_id         INTEGER NOT NULL REFERENCES users(id),
        arrived_at      TEXT    NOT NULL,           -- время приезда машины
        wash_mode       INTEGER NOT NULL,
        -- 1=Экспресс 2=Стандарт 3=Комплекс 4=Премиум
        payment_method  TEXT    NOT NULL,
        -- 'cash' | 'card' | 'qr'
        amount          REAL    NOT NULL DEFAULT 0,
        extra_service   INTEGER NOT NULL DEFAULT 0, -- 1 если была доп.услуга
        extra_service_name TEXT,
        extra_payment   TEXT,
        -- способ оплаты доп.услуги
        extra_amount    REAL    NOT NULL DEFAULT 0,
        windows_wiped   INTEGER NOT NULL DEFAULT 0, -- 1 если протёрли стёкла
        note            TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
    """)

    # ── События / Журнал ──────────────────────────────────────────────────────
    cur.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER REFERENCES users(id),
        shift_id    INTEGER REFERENCES shifts(id),
        event_type  TEXT    NOT NULL,
        -- 'shift_start'|'shift_end'|'car_added'|'late'|
        --  'camera'|'admin_note'|'system'|'ai_query'
        title       TEXT    NOT NULL,
        body        TEXT,
        source      TEXT    NOT NULL DEFAULT 'app',
        -- 'app'|'telegram'|'system'|'camera'
        screenshot  TEXT,               -- путь к файлу скриншота
        created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
    """)

    # ── Настройки приложения ──────────────────────────────────────────────────
    cur.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key     TEXT PRIMARY KEY,
        value   TEXT NOT NULL
    )
    """)

    # ── AI-запросы / история чата ─────────────────────────────────────────────
    cur.execute("""
    CREATE TABLE IF NOT EXISTS ai_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER REFERENCES users(id),
        source      TEXT NOT NULL DEFAULT 'app',
        -- 'app'|'telegram'
        question    TEXT NOT NULL,
        answer      TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
    """)

    # ── Индексы для ускорения запросов ────────────────────────────────────────
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cars_shift ON cars(shift_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date)")

    # ── Дефолтные настройки ───────────────────────────────────────────────────
    defaults = {
        "shift_start_time":   "08:00",
        "shift_end_time":     "23:00",
        "late_threshold_min": "15",
        "wash_mode_1":        "Экспресс",
        "wash_mode_2":        "Стандарт",
        "wash_mode_3":        "Комплекс",
        "wash_mode_4":        "Премиум",
        "tg_bot_token":       "",
        "tg_admin_chat_id":   "",
        "tg_group_chat_id":   "",
        "vk_token":           "",
        "vk_owner_id":        "",
        "vk_group_id":        "",
        "trassir_host":       "127.0.0.1",
        "trassir_port":       "8080",
        "trassir_login":      "admin",
        "trassir_password":   "",
        "ai_enabled":         "1",
        "ai_model_path":      "",
        "backup_enabled":     "1",
        "backup_hour":        "3",
        "app_version":        "1.0.0",
    }
    for k, v in defaults.items():
        cur.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v)
        )

    # ── Дефолтные пользователи ────────────────────────────────────────────────
    admin_pw = hash_password("admin123")
    op_pw    = hash_password("operator1")

    cur.execute("""
        INSERT OR IGNORE INTO users (username, full_name, password, role)
        VALUES (?, ?, ?, ?)
    """, ("admin", "Администратор", admin_pw, "admin"))

    cur.execute("""
        INSERT OR IGNORE INTO users (username, full_name, password, role)
        VALUES (?, ?, ?, ?)
    """, ("operator1", "Оператор 1", op_pw, "operator"))

    conn.commit()
    conn.close()
    print(f"[DB] База данных инициализирована: {DB_PATH}")


# ── Вспомогательные функции ───────────────────────────────────────────────────

def get_setting(key: str, default: str = "") -> str:
    conn = get_connection()
    row = conn.execute(
        "SELECT value FROM settings WHERE key = ?", (key,)
    ).fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key: str, value: str):
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value)
    )
    conn.commit()
    conn.close()


def get_all_settings() -> dict:
    conn = get_connection()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


if __name__ == "__main__":
    init_db()
