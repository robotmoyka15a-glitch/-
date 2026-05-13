"""
WashControl — AI воркер
Поддержка четырёх провайдеров: builtin | llama_cpp | ollama | clo

Провайдеры (приоритет задаётся настройкой ai_provider):
  builtin   — встроенный, без GPU, отвечает напрямую из БД (всегда работает)
  llama_cpp — локальная GGUF-модель через llama-cpp-python
  ollama    — Ollama API (http://localhost:11434/api/chat)
  clo       — Clo Cloud API (требует clo_api_key)

Fallback: любой провайдер кроме builtin при недоступности деградирует на builtin.
"""

import logging
import threading
import asyncio
from typing import Optional
from datetime import date, datetime

logger = logging.getLogger("washcontrol.ai")

# ── Глобальный экземпляр llama_cpp модели ────────────────────────────────────
_llm = None
_llm_lock = threading.Lock()
_llm_load_failed = False          # чтобы не пытаться повторно


# ═══════════════════════════════════════════════════════════════════════════════
#  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ═══════════════════════════════════════════════════════════════════════════════

def get_ai_provider() -> str:
    """Возвращает текущий провайдер из настроек (по умолчанию 'builtin')."""
    try:
        from backend.database import get_setting
        return get_setting("ai_provider", "builtin").strip().lower()
    except Exception:
        return "builtin"


def is_available() -> bool:
    """
    Проверяет доступность AI.
    builtin — всегда доступен.
    Остальные — если соответствующий ресурс настроен.
    """
    provider = get_ai_provider()
    if provider == "builtin":
        return True
    if provider == "llama_cpp":
        from backend.config import AI_MODELS_DIR
        from backend.database import get_setting
        model_path = get_setting("ai_model_path", "")
        if model_path:
            from pathlib import Path
            return Path(model_path).exists()
        return bool(list(AI_MODELS_DIR.glob("*.gguf")))
    if provider == "ollama":
        from backend.database import get_setting
        return bool(get_setting("ollama_url", ""))
    if provider == "clo":
        from backend.database import get_setting
        return bool(get_setting("clo_api_key", ""))
    return True  # builtin fallback


# ═══════════════════════════════════════════════════════════════════════════════
#  СБОРКА КОНТЕКСТА ИЗ БД
# ═══════════════════════════════════════════════════════════════════════════════

def _build_context() -> str:
    """Собирает текущие данные системы для передачи AI-провайдеру."""
    try:
        from backend.database import get_connection
        from backend.config import WASH_MODES
        today = date.today().isoformat()
        conn = get_connection()

        shifts = conn.execute(
            """SELECT u.full_name, s.started_at, s.ended_at, s.is_late, s.late_minutes
               FROM shifts s JOIN users u ON s.user_id = u.id
               WHERE s.date = ?""",
            (today,)
        ).fetchall()

        stats = conn.execute(
            """SELECT COUNT(*) as cars,
                      COALESCE(SUM(amount+extra_amount), 0) as revenue,
                      SUM(CASE WHEN extra_service=1 THEN 1 ELSE 0 END) as extras,
                      SUM(CASE WHEN windows_wiped=1 THEN 1 ELSE 0 END) as wiped
               FROM cars c JOIN shifts s ON c.shift_id=s.id WHERE s.date=?""",
            (today,)
        ).fetchone()

        by_mode = conn.execute(
            """SELECT wash_mode, COUNT(*) as cnt
               FROM cars c JOIN shifts s ON c.shift_id=s.id
               WHERE s.date=? GROUP BY wash_mode""",
            (today,)
        ).fetchall()

        conn.close()

        shift_info = []
        for s in shifts:
            end_txt = s["ended_at"][11:16] if s["ended_at"] else "открыта"
            late_txt = f", опоздание {s['late_minutes']} мин" if s["is_late"] else ""
            shift_info.append(
                f"  - {s['full_name']}: {s['started_at'][11:16]}–{end_txt}{late_txt}"
            )

        modes_info = ", ".join(
            f"{WASH_MODES.get(r['wash_mode'], '?')}: {r['cnt']}"
            for r in by_mode
        ) or "нет данных"

        return (
            f"Текущая дата: {today}\n"
            f"Смены сегодня:\n" + ("\n".join(shift_info) or "  нет смен") + "\n"
            f"Статистика за день:\n"
            f"  - Машин: {stats['cars']}\n"
            f"  - Выручка: {stats['revenue']:.0f} руб.\n"
            f"  - Доп.услуг: {stats['extras']}\n"
            f"  - Протёрты стёкла: {stats['wiped']}\n"
            f"  - По режимам: {modes_info}\n"
        )
    except Exception as e:
        logger.warning(f"Не удалось собрать контекст: {e}")
        return f"Дата: {date.today().isoformat()}"


SYSTEM_PROMPT = """Ты — помощник администратора автомойки.
Твоя задача — кратко и чётко отвечать на вопросы по работе мойки.
Используй только русский язык.
Отвечай деловым стилем, коротко (2–5 предложений максимум).
Если данных нет — так и скажи, не придумывай."""


# ═══════════════════════════════════════════════════════════════════════════════
#  ПРОВАЙДЕР: BUILTIN (SQL-ответы напрямую из БД)
# ═══════════════════════════════════════════════════════════════════════════════

def _builtin_answer(question: str) -> str:
    """
    Встроенный провайдер — отвечает на типовые вопросы через SQL.
    Работает всегда, без внешних зависимостей.
    """
    q = question.lower()
    try:
        from backend.database import get_connection
        today = date.today().isoformat()
        conn = get_connection()

        # ── Количество машин ─────────────────────────────────────────────────
        if any(w in q for w in ["сколько машин", "машин сегодня", "машин за", "авто сегодня"]):
            r = conn.execute(
                "SELECT COUNT(*) as n FROM cars c "
                "JOIN shifts s ON c.shift_id=s.id WHERE s.date=?",
                (today,)
            ).fetchone()
            conn.close()
            return f"За сегодня ({today}) помыто машин: {r['n']}."

        # ── Выручка ──────────────────────────────────────────────────────────
        if any(w in q for w in ["выручка", "деньги", "сумма", "заработали", "выручили", "доход"]):
            r = conn.execute(
                "SELECT COALESCE(SUM(amount+extra_amount), 0) as rev "
                "FROM cars c JOIN shifts s ON c.shift_id=s.id WHERE s.date=?",
                (today,)
            ).fetchone()
            conn.close()
            return f"Выручка за сегодня ({today}): {r['rev']:.0f} ₽."

        # ── Кто на смене / оператор ──────────────────────────────────────────
        if any(w in q for w in ["кто на смене", "кто работает", "оператор", "на смене", "смена сейчас"]):
            shifts = conn.execute(
                "SELECT u.full_name, s.started_at FROM shifts s "
                "JOIN users u ON s.user_id=u.id "
                "WHERE s.date=? AND s.ended_at IS NULL",
                (today,)
            ).fetchall()
            conn.close()
            if shifts:
                names = ", ".join(
                    f"{s['full_name']} (с {s['started_at'][11:16]})" for s in shifts
                )
                return f"Сейчас на смене: {names}."
            return "Активных смен нет."

        # ── Опоздания ────────────────────────────────────────────────────────
        if any(w in q for w in ["опоздание", "опоздал", "опоздания", "late"]):
            rows = conn.execute(
                "SELECT u.full_name, s.late_minutes FROM shifts s "
                "JOIN users u ON s.user_id=u.id "
                "WHERE s.date=? AND s.is_late=1",
                (today,)
            ).fetchall()
            conn.close()
            if rows:
                items = ", ".join(
                    f"{r['full_name']} (+{r['late_minutes']} мин)" for r in rows
                )
                return f"Опоздания сегодня: {items}."
            return "Сегодня опозданий не зафиксировано."

        # ── Последние машины ─────────────────────────────────────────────────
        if any(w in q for w in ["последние машины", "последние авто", "недавние машины"]):
            from backend.config import WASH_MODES, PAYMENT_METHODS
            rows = conn.execute(
                "SELECT c.arrived_at, c.wash_mode, c.amount, c.extra_amount "
                "FROM cars c JOIN shifts s ON c.shift_id=s.id "
                "WHERE s.date=? ORDER BY c.arrived_at DESC LIMIT 5",
                (today,)
            ).fetchall()
            conn.close()
            if not rows:
                return "Машин за сегодня пока нет."
            lines = ["Последние 5 машин:"]
            for i, r in enumerate(reversed(rows), 1):
                mode = WASH_MODES.get(r["wash_mode"], "?")
                total = r["amount"] + r["extra_amount"]
                lines.append(f"{i}. {r['arrived_at'][11:16]} — {mode}, {total:.0f} ₽")
            return "\n".join(lines)

        # ── Сводка / итоги дня ───────────────────────────────────────────────
        if any(w in q for w in ["сводка", "итоги", "итог", "отчёт", "отчет", "сегодня", "за день"]):
            conn.close()
            return _builtin_summary()

        # ── Fallback: вернуть полную сводку ─────────────────────────────────
        conn.close()
        return _builtin_summary()

    except Exception as e:
        logger.warning(f"Builtin answer error: {e}")
        return _builtin_summary()


def _builtin_summary() -> str:
    """Полная структурированная сводка дня — универсальный ответ builtin."""
    try:
        from backend.database import get_connection
        from backend.config import WASH_MODES
        today = date.today().isoformat()
        conn = get_connection()

        stats = conn.execute(
            """SELECT COUNT(*) as cars,
                      COALESCE(SUM(amount+extra_amount), 0) as revenue,
                      SUM(CASE WHEN extra_service=1 THEN 1 ELSE 0 END) as extras,
                      SUM(CASE WHEN windows_wiped=1 THEN 1 ELSE 0 END) as wiped
               FROM cars c JOIN shifts s ON c.shift_id=s.id WHERE s.date=?""",
            (today,)
        ).fetchone()

        active_shifts = conn.execute(
            "SELECT u.full_name FROM shifts s JOIN users u ON s.user_id=u.id "
            "WHERE s.date=? AND s.ended_at IS NULL",
            (today,)
        ).fetchall()

        late_shifts = conn.execute(
            "SELECT u.full_name, s.late_minutes FROM shifts s "
            "JOIN users u ON s.user_id=u.id "
            "WHERE s.date=? AND s.is_late=1",
            (today,)
        ).fetchall()

        by_mode = conn.execute(
            "SELECT wash_mode, COUNT(*) as cnt FROM cars c "
            "JOIN shifts s ON c.shift_id=s.id "
            "WHERE s.date=? GROUP BY wash_mode",
            (today,)
        ).fetchall()

        conn.close()

        active_txt = (
            ", ".join(s["full_name"] for s in active_shifts)
            if active_shifts else "нет"
        )
        late_txt = (
            ", ".join(f"{r['full_name']} (+{r['late_minutes']} мин)" for r in late_shifts)
            if late_shifts else "нет"
        )
        modes_txt = (
            ", ".join(
                f"{WASH_MODES.get(r['wash_mode'], '?')}: {r['cnt']}"
                for r in by_mode
            ) or "нет данных"
        )

        return (
            f"📊 Сводка за {today}:\n"
            f"• Машин помыто: {stats['cars']}\n"
            f"• Выручка: {stats['revenue']:.0f} ₽\n"
            f"• Доп.услуг: {stats['extras']}\n"
            f"• Протёрты стёкла: {stats['wiped']}\n"
            f"• Режимы: {modes_txt}\n"
            f"• На смене: {active_txt}\n"
            f"• Опоздания: {late_txt}"
        )
    except Exception as e:
        logger.warning(f"Builtin summary error: {e}")
        return f"Сводка за {date.today().isoformat()}: данные недоступны ({e})"


# ═══════════════════════════════════════════════════════════════════════════════
#  ПРОВАЙДЕР: LLAMA_CPP
# ═══════════════════════════════════════════════════════════════════════════════

def _get_llm_model():
    """Ленивая загрузка llama_cpp модели, один раз при первом вызове."""
    global _llm, _llm_load_failed
    if _llm is not None:
        return _llm
    if _llm_load_failed:
        return None

    with _llm_lock:
        if _llm is not None:
            return _llm
        if _llm_load_failed:
            return None

        try:
            from backend.database import get_setting
            from backend.config import AI_MODELS_DIR, DEFAULT_AI_MODEL, AI_MAX_TOKENS, AI_CONTEXT_SIZE

            model_path = get_setting("ai_model_path", "")
            if not model_path:
                candidates = list(AI_MODELS_DIR.glob("*.gguf"))
                if candidates:
                    model_path = str(candidates[0])
                else:
                    logger.warning("llama_cpp: .gguf файл не найден в data/models/")
                    _llm_load_failed = True
                    return None

            from llama_cpp import Llama
            logger.info(f"Загрузка llama_cpp модели: {model_path}")
            _llm = Llama(
                model_path=model_path,
                n_ctx=AI_CONTEXT_SIZE,
                n_threads=2,
                n_gpu_layers=0,
                verbose=False,
                chat_format="chatml",
            )
            logger.info("llama_cpp модель загружена успешно")
            return _llm
        except ImportError:
            logger.warning("llama-cpp-python не установлен, fallback на builtin")
            _llm_load_failed = True
            return None
        except Exception as e:
            logger.error(f"Ошибка загрузки llama_cpp модели: {e}")
            _llm_load_failed = True
            return None


def _ask_llama_cpp(question: str) -> Optional[str]:
    """Запрос к llama_cpp. Возвращает None при неудаче."""
    llm = _get_llm_model()
    if llm is None:
        return None

    context = _build_context()
    messages = [
        {"role": "system",    "content": SYSTEM_PROMPT},
        {"role": "user",      "content": f"Данные системы:\n{context}"},
        {"role": "assistant", "content": "Понял, готов отвечать на вопросы."},
        {"role": "user",      "content": question},
    ]
    try:
        from backend.config import AI_MAX_TOKENS, AI_TEMPERATURE
        response = llm.create_chat_completion(
            messages=messages,
            max_tokens=AI_MAX_TOKENS,
            temperature=AI_TEMPERATURE,
            stop=["<|im_end|>", "</s>"],
        )
        return response["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error(f"llama_cpp inference error: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
#  ПРОВАЙДЕР: OLLAMA
# ═══════════════════════════════════════════════════════════════════════════════

def _ask_ollama(question: str) -> Optional[str]:
    """Запрос к Ollama API. Возвращает None при неудаче."""
    try:
        import urllib.request
        import json
        from backend.database import get_setting

        ollama_url = get_setting("ollama_url", "http://localhost:11434").rstrip("/")
        model_name = get_setting("ollama_model", "llama3")
        context = _build_context()

        payload = json.dumps({
            "model": model_name,
            "messages": [
                {"role": "system",    "content": SYSTEM_PROMPT},
                {"role": "user",      "content": f"Данные системы:\n{context}"},
                {"role": "assistant", "content": "Понял, готов отвечать на вопросы."},
                {"role": "user",      "content": question},
            ],
            "stream": False,
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{ollama_url}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["message"]["content"].strip()
    except Exception as e:
        logger.warning(f"Ollama недоступен ({e}), fallback на builtin")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
#  ПРОВАЙДЕР: CLO (Cloud)
# ═══════════════════════════════════════════════════════════════════════════════

def _ask_clo(question: str) -> Optional[str]:
    """Запрос к Clo Cloud API. Возвращает None при неудаче."""
    try:
        import urllib.request
        import json
        from backend.database import get_setting

        api_key  = get_setting("clo_api_key", "")
        api_url  = get_setting("clo_api_url", "https://api.clo.ru/v1/chat/completions")
        model    = get_setting("clo_model", "gpt-4o-mini")

        if not api_key:
            logger.warning("clo_api_key не задан, fallback на builtin")
            return None

        context = _build_context()
        payload = json.dumps({
            "model": model,
            "messages": [
                {"role": "system",    "content": SYSTEM_PROMPT},
                {"role": "user",      "content": f"Данные системы:\n{context}"},
                {"role": "assistant", "content": "Понял, готов отвечать на вопросы."},
                {"role": "user",      "content": question},
            ],
            "max_tokens": 512,
            "temperature": 0.3,
        }).encode("utf-8")

        req = urllib.request.Request(
            api_url,
            data=payload,
            headers={
                "Content-Type":  "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning(f"Clo API недоступен ({e}), fallback на builtin")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
#  ИСТОРИЯ
# ═══════════════════════════════════════════════════════════════════════════════

def _save_history(question: str, answer: str, source: str, provider: str = "builtin"):
    try:
        from backend.database import get_connection
        conn = get_connection()
        conn.execute(
            "INSERT INTO ai_history (source, question, answer) VALUES (?,?,?)",
            (f"{source}[{provider}]", question, answer)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Не удалось сохранить AI историю: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
#  ПУБЛИЧНЫЙ API
# ═══════════════════════════════════════════════════════════════════════════════

def ask_ai(question: str, source: str = "app") -> str:
    """
    Основная функция: задать вопрос AI.

    Порядок провайдеров (из настройки ai_provider):
      builtin   → сразу отвечает из БД
      llama_cpp → пробует модель → fallback builtin
      ollama    → пробует Ollama → fallback builtin
      clo       → пробует Clo   → fallback builtin
    """
    provider = get_ai_provider()
    answer: Optional[str] = None
    used_provider = provider

    if provider == "llama_cpp":
        answer = _ask_llama_cpp(question)
        if answer is None:
            logger.info("llama_cpp fallback → builtin")
            used_provider = "builtin"

    elif provider == "ollama":
        answer = _ask_ollama(question)
        if answer is None:
            logger.info("ollama fallback → builtin")
            used_provider = "builtin"

    elif provider == "clo":
        answer = _ask_clo(question)
        if answer is None:
            logger.info("clo fallback → builtin")
            used_provider = "builtin"

    # builtin (или fallback)
    if answer is None:
        answer = _builtin_answer(question)
        used_provider = "builtin"

    _save_history(question, answer, source, used_provider)
    return answer


def ask_ai_sync(question: str, source: str = "app") -> str:
    """Синхронная обёртка — для вызова из Telegram-хендлеров и планировщика."""
    return ask_ai(question, source)


def generate_daily_summary() -> str:
    """Генерация ежедневной сводки — вызывается в конце дня планировщиком."""
    today = date.today().isoformat()
    question = (
        f"Составь краткую деловую сводку за {today}. "
        "Укажи: сколько машин помыто, выручку, режимы, опоздания если были, "
        "общую оценку дня в 1 предложении."
    )
    return ask_ai(question, source="system")
