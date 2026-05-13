"""
WashControl — AI воркер (локальный, CPU-only)
Модель: Qwen2.5-3B-Instruct Q4_K_M (GGUF)
~2.3 ГБ RAM, без GPU, русский язык

Установка модели:
  1. Скачать файл qwen2.5-3b-instruct-q4_k_m.gguf с Hugging Face
     https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF
  2. Поместить в папку data/models/
  3. Указать путь в настройках: Settings → ai_model_path

Зависимость: pip install llama-cpp-python
"""

import logging
import threading
from typing import Optional
from datetime import date

logger = logging.getLogger("washcontrol.ai")

# ── Глобальный экземпляр модели (загружается один раз) ───────────────────────
_llm = None
_llm_lock = threading.Lock()


def _get_model():
    """Ленивая загрузка модели при первом обращении."""
    global _llm
    if _llm is not None:
        return _llm

    with _llm_lock:
        if _llm is not None:
            return _llm

        from backend.database import get_setting
        from backend.config import AI_MODELS_DIR, DEFAULT_AI_MODEL, AI_MAX_TOKENS, AI_CONTEXT_SIZE

        enabled = get_setting("ai_enabled", "1")
        if enabled != "1":
            return None

        model_path = get_setting("ai_model_path")
        if not model_path:
            # Попробовать найти автоматически
            candidates = list(AI_MODELS_DIR.glob("*.gguf"))
            if candidates:
                model_path = str(candidates[0])
            else:
                logger.warning("AI модель не найдена. Поместите .gguf файл в data/models/")
                return None

        try:
            from llama_cpp import Llama
            logger.info(f"Загрузка AI модели: {model_path}")
            _llm = Llama(
                model_path=model_path,
                n_ctx=AI_CONTEXT_SIZE,
                n_threads=2,          # 2 потока — бережём CPU
                n_gpu_layers=0,       # строго CPU
                verbose=False,
                chat_format="chatml",
            )
            logger.info("AI модель загружена успешно")
            return _llm
        except ImportError:
            logger.warning("llama-cpp-python не установлен. AI недоступен.")
            return None
        except Exception as e:
            logger.error(f"Ошибка загрузки AI модели: {e}")
            return None


# ── Контекст для промптов ──────────────────────────────────────────────────

def _build_context() -> str:
    """Собирает текущие данные системы для AI."""
    try:
        from backend.database import get_connection
        from backend.config import WASH_MODES, PAYMENT_METHODS
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
                      COALESCE(SUM(amount+extra_amount),0) as revenue,
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
            f"{WASH_MODES.get(r['wash_mode'],'?')}: {r['cnt']}"
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
        logger.warning(f"Не удалось собрать контекст для AI: {e}")
        return f"Дата: {date.today().isoformat()}"


SYSTEM_PROMPT = """Ты — помощник администратора автомойки. 
Твоя задача — кратко и чётко отвечать на вопросы по работе мойки.
Используй только русский язык.
Отвечай деловым стилем, коротко (2–5 предложений максимум).
Если данных нет — так и скажи, не придумывай."""


def ask_ai(question: str, source: str = "app") -> str:
    """
    Основная функция: задать вопрос AI.
    Возвращает строку с ответом.
    Fallback: возвращает сообщение что AI недоступен.
    """
    llm = _get_model()
    if llm is None:
        return _fallback_answer(question)

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
        answer = response["choices"][0]["message"]["content"].strip()

        # Сохранить в историю
        _save_history(question, answer, source)
        return answer
    except Exception as e:
        logger.error(f"AI inference error: {e}")
        return f"Не удалось получить ответ AI. ({e})"


def ask_ai_sync(question: str, source: str = "app") -> str:
    """Синхронная обёртка для вызова из Telegram хендлеров."""
    return ask_ai(question, source)


def _fallback_answer(question: str) -> str:
    """
    Простой fallback когда модель не загружена.
    Отвечает на типовые вопросы напрямую из БД.
    """
    q = question.lower()
    try:
        from backend.database import get_connection
        today = date.today().isoformat()
        conn = get_connection()

        if any(w in q for w in ["сколько машин", "машин", "авто"]):
            r = conn.execute(
                "SELECT COUNT(*) as n FROM cars c "
                "JOIN shifts s ON c.shift_id=s.id WHERE s.date=?",
                (today,)
            ).fetchone()
            conn.close()
            return f"За сегодня ({today}) помыто машин: {r['n']}."

        if any(w in q for w in ["выручка", "деньги", "сумма", "заработали"]):
            r = conn.execute(
                "SELECT COALESCE(SUM(amount+extra_amount),0) as rev "
                "FROM cars c JOIN shifts s ON c.shift_id=s.id WHERE s.date=?",
                (today,)
            ).fetchone()
            conn.close()
            return f"Выручка за сегодня ({today}): {r['rev']:.0f} ₽."

        if any(w in q for w in ["смена", "оператор", "работает", "кто"]):
            shifts = conn.execute(
                "SELECT u.full_name FROM shifts s JOIN users u ON s.user_id=u.id "
                "WHERE s.date=? AND s.ended_at IS NULL",
                (today,)
            ).fetchall()
            conn.close()
            if shifts:
                names = ", ".join(s["full_name"] for s in shifts)
                return f"Сейчас на смене: {names}."
            return "Активных смен нет."

        conn.close()
    except Exception:
        pass

    return "AI-модель не загружена. Используйте команды /today, /shift, /cars в Telegram."


def _save_history(question: str, answer: str, source: str):
    try:
        from backend.database import get_connection
        conn = get_connection()
        conn.execute(
            "INSERT INTO ai_history (source, question, answer) VALUES (?,?,?)",
            (source, question, answer)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Не удалось сохранить AI историю: {e}")


def generate_daily_summary() -> str:
    """Генерация ежедневной сводки — вызывается автоматически в конце дня."""
    today = date.today().isoformat()
    question = (
        f"Составь краткую деловую сводку за {today}. "
        "Укажи: сколько машин помыто, выручку, режимы, опоздания если были, "
        "общую оценку дня в 1 предложении."
    )
    return ask_ai(question, source="system")


def is_available() -> bool:
    """Проверить доступность AI без загрузки модели."""
    from backend.database import get_setting
    from backend.config import AI_MODELS_DIR
    if get_setting("ai_enabled", "1") != "1":
        return False
    model_path = get_setting("ai_model_path")
    if model_path:
        from pathlib import Path
        return Path(model_path).exists()
    return bool(list(AI_MODELS_DIR.glob("*.gguf")))
