"""
WashControl — Telegram бот
Уведомления + запросы данных через чат
Запускается как отдельный asyncio-поток внутри FastAPI
"""

import asyncio
import logging
import threading
from datetime import date, datetime
from typing import Optional

logger = logging.getLogger("washcontrol.telegram")

# ── Глобальный экземпляр приложения бота ────────────────────────────────────
_bot_app = None
_bot_loop: Optional[asyncio.AbstractEventLoop] = None
_bot_thread: Optional[threading.Thread] = None

# ── Антиспам: время последнего вопроса по chat_id ────────────────────────────
_last_question_time: dict = {}
_SPAM_INTERVAL_SEC = 3          # минимум 3 секунды между вопросами


# ── Фабрика бота ─────────────────────────────────────────────────────────────

def _build_app(token: str):
    """Собирает telegram.ext.Application с хендлерами."""
    from telegram.ext import (
        Application, CommandHandler, MessageHandler, filters
    )

    app = Application.builder().token(token).build()

    # Англоязычные команды
    app.add_handler(CommandHandler("start",   cmd_start))
    app.add_handler(CommandHandler("help",    cmd_help))
    app.add_handler(CommandHandler("status",  cmd_status))
    app.add_handler(CommandHandler("today",   cmd_today))
    app.add_handler(CommandHandler("shift",   cmd_shift))
    app.add_handler(CommandHandler("cars",    cmd_cars))
    app.add_handler(CommandHandler("report",  cmd_report))

    # Русскоязычные алиасы
    app.add_handler(CommandHandler("сегодня", cmd_today))
    app.add_handler(CommandHandler("помощь",  cmd_help))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    return app


# ── Команды бота ──────────────────────────────────────────────────────────────

async def cmd_start(update, context):
    await update.message.reply_text(
        "👋 *WashControl Bot*\n\n"
        "Я помогаю следить за автомойкой.\n\n"
        "Команды:\n"
        "/status — текущий статус\n"
        "/today (или /сегодня) — итоги сегодняшнего дня\n"
        "/shift — открытые смены\n"
        "/cars — машины за сегодня\n"
        "/report — краткий отчёт\n"
        "/help (или /помощь) — справка",
        parse_mode="Markdown"
    )


async def cmd_help(update, context):
    await update.message.reply_text(
        "📋 *Доступные команды:*\n\n"
        "/status — смены и операторы онлайн\n"
        "/today или /сегодня — сводка за день\n"
        "/shift — детали текущих смен\n"
        "/cars N — последние N машин (по умолчанию 5)\n"
        "/report — полный дневной отчёт\n\n"
        "Или напишите вопрос свободным текстом — AI ответит.",
        parse_mode="Markdown"
    )


async def cmd_status(update, context):
    try:
        from backend.database import get_connection
        today = date.today().isoformat()
        conn = get_connection()
        shifts = conn.execute(
            """SELECT s.*, u.full_name FROM shifts s
               JOIN users u ON s.user_id = u.id
               WHERE s.date = ? AND s.ended_at IS NULL""",
            (today,)
        ).fetchall()
        conn.close()

        if not shifts:
            await update.message.reply_text("🔴 Активных смен нет.")
            return

        lines = ["✅ *Активные смены:*"]
        for s in shifts:
            late = f" ⚠️ опоздание {s['late_minutes']} мин" if s["is_late"] else ""
            lines.append(f"• {s['full_name']} — с {s['started_at'][11:16]}{late}")
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")


async def cmd_today(update, context):
    try:
        from backend.database import get_connection
        today = date.today().isoformat()
        conn = get_connection()
        stats = conn.execute(
            """SELECT COUNT(*) as total,
                      COALESCE(SUM(amount+extra_amount), 0) as revenue
               FROM cars c JOIN shifts s ON c.shift_id=s.id WHERE s.date=?""",
            (today,)
        ).fetchone()
        conn.close()

        msg = (
            f"📊 *Итоги {today}*\n\n"
            f"🚗 Машин: *{stats['total']}*\n"
            f"💰 Выручка: *{stats['revenue']:.0f} ₽*"
        )
        await update.message.reply_text(msg, parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")


async def cmd_shift(update, context):
    await cmd_status(update, context)


async def cmd_cars(update, context):
    try:
        n = 5
        if context.args:
            try:
                n = int(context.args[0])
            except ValueError:
                pass
        n = min(n, 20)

        from backend.database import get_connection
        from backend.config import WASH_MODES, PAYMENT_METHODS
        today = date.today().isoformat()
        conn = get_connection()
        rows = conn.execute(
            """SELECT c.*, u.full_name FROM cars c
               JOIN shifts s ON c.shift_id=s.id
               JOIN users u ON c.user_id=u.id
               WHERE s.date=? ORDER BY c.arrived_at DESC LIMIT ?""",
            (today, n)
        ).fetchall()
        conn.close()

        if not rows:
            await update.message.reply_text("🚗 Машин за сегодня пока нет.")
            return

        lines = [f"🚗 *Последние {len(rows)} машин:*"]
        for i, r in enumerate(reversed(rows), 1):
            mode = WASH_MODES.get(r["wash_mode"], "?")
            pay  = PAYMENT_METHODS.get(r["payment_method"], "?")
            extra = " +доп" if r["extra_service"] else ""
            lines.append(
                f"{i}. {r['arrived_at'][11:16]} | {mode} | {pay} {r['amount']:.0f}₽{extra}"
            )
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")


async def cmd_report(update, context):
    try:
        from backend.database import get_connection
        from backend.config import WASH_MODES, PAYMENT_METHODS
        today = date.today().isoformat()
        conn = get_connection()

        summary = conn.execute(
            """SELECT COUNT(*) as cars,
                      COALESCE(SUM(amount),0) as main_rev,
                      COALESCE(SUM(extra_amount),0) as extra_rev,
                      COALESCE(SUM(amount+extra_amount),0) as total,
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

        shifts = conn.execute(
            """SELECT u.full_name, s.started_at, s.ended_at, s.is_late
               FROM shifts s JOIN users u ON s.user_id=u.id
               WHERE s.date=?""",
            (today,)
        ).fetchall()
        conn.close()

        mode_lines = ", ".join(
            f"{WASH_MODES.get(r['wash_mode'], '?')}: {r['cnt']}"
            for r in by_mode
        )

        shift_lines = []
        for s in shifts:
            end = s["ended_at"][11:16] if s["ended_at"] else "открыта"
            late = " ⚠️" if s["is_late"] else ""
            shift_lines.append(f"• {s['full_name']}: {s['started_at'][11:16]}–{end}{late}")

        msg = (
            f"📋 *Отчёт за {today}*\n\n"
            f"🚗 Машин: *{summary['cars']}*\n"
            f"💰 Осн. выручка: *{summary['main_rev']:.0f} ₽*\n"
            f"➕ Доп. услуги: *{summary['extra_rev']:.0f} ₽*\n"
            f"💵 Итого: *{summary['total']:.0f} ₽*\n"
            f"🪟 Протёрты стёкла: *{summary['wiped']}*\n"
            f"⭐ Доп. услуг: *{summary['extras']}*\n\n"
            f"Режимы: {mode_lines}\n\n"
            f"Смены:\n" + "\n".join(shift_lines)
        )
        await update.message.reply_text(msg, parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"Ошибка: {e}")


async def handle_text(update, context):
    """Свободный вопрос — антиспам + передача в AI-воркер."""
    question = update.message.text.strip()
    if len(question) < 3:
        return

    # ── Антиспам ─────────────────────────────────────────────────────────────
    chat_id = update.message.chat_id
    now = datetime.now().timestamp()
    last_ts = _last_question_time.get(chat_id, 0)
    if now - last_ts < _SPAM_INTERVAL_SEC:
        return  # молча игнорируем слишком частые запросы
    _last_question_time[chat_id] = now

    await update.message.reply_text("🤔 Думаю...")
    try:
        from backend.services.ai_worker import ask_ai_sync
        answer = ask_ai_sync(question, source="telegram")
        await update.message.reply_text(f"🤖 {answer}")
    except Exception as e:
        logger.warning(f"AI ответ не получен: {e}")
        await update.message.reply_text(
            "AI недоступен. Попробуйте команды:\n/today /shift /cars /report"
        )


# ── Отправка уведомлений (вызывается из других модулей) ──────────────────────

def _run_coro(coro):
    """Безопасно запускает корутину из синхронного кода."""
    global _bot_loop
    if _bot_loop is not None and _bot_loop.is_running():
        asyncio.run_coroutine_threadsafe(coro, _bot_loop)
    else:
        logger.debug("_run_coro: event loop не активен, сообщение не отправлено")


def notify(text: str, parse_mode: str = "Markdown"):
    """Отправить уведомление администратору и в группу."""
    from backend.database import get_setting
    token  = get_setting("tg_bot_token")
    admin  = get_setting("tg_admin_chat_id")
    group  = get_setting("tg_group_chat_id")
    if not token:
        return
    for chat_id in filter(None, [admin, group]):
        _run_coro(_send_message(token, chat_id, text, parse_mode))


def notify_admin(text: str):
    """Уведомление только администратору."""
    from backend.database import get_setting
    token   = get_setting("tg_bot_token")
    chat_id = get_setting("tg_admin_chat_id")
    if token and chat_id:
        _run_coro(_send_message(token, chat_id, text))


def notify_group(text: str, parse_mode: str = "Markdown"):
    """Отправка только в группу."""
    from backend.database import get_setting
    token   = get_setting("tg_bot_token")
    chat_id = get_setting("tg_group_chat_id")
    if token and chat_id:
        _run_coro(_send_message(token, chat_id, text, parse_mode))


def send_photo_sync(filepath: str, caption: str = ""):
    """Отправить фото администратору."""
    from backend.database import get_setting
    token   = get_setting("tg_bot_token")
    chat_id = get_setting("tg_admin_chat_id")
    if token and chat_id:
        _run_coro(_send_photo(token, chat_id, filepath, caption))


async def _send_message(token: str, chat_id: str, text: str,
                        parse_mode: str = "Markdown"):
    try:
        from telegram import Bot
        bot = Bot(token=token)
        await bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode)
    except Exception as e:
        logger.warning(f"Telegram send failed: {e}")


async def _send_photo(token: str, chat_id: str, filepath: str, caption: str):
    try:
        from telegram import Bot
        bot = Bot(token=token)
        with open(filepath, "rb") as f:
            await bot.send_photo(chat_id=chat_id, photo=f, caption=caption)
    except Exception as e:
        logger.warning(f"Telegram photo send failed: {e}")


# ── Запуск / остановка бота ───────────────────────────────────────────────────

def start_bot():
    """
    Запускает бота в отдельном потоке.
    Вызывается при старте FastAPI.
    Если бот уже запущен — повторный запуск пропускается.
    """
    global _bot_app, _bot_loop, _bot_thread

    # Защита от повторного запуска
    if _bot_thread is not None and _bot_thread.is_alive():
        logger.info("Telegram бот уже запущен, повторный запуск пропущен")
        return

    from backend.database import get_setting
    token = get_setting("tg_bot_token")
    if not token:
        logger.info("Telegram bot token не задан, бот не запущен")
        return

    def _run():
        global _bot_app, _bot_loop
        try:
            _bot_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(_bot_loop)
            _bot_app = _build_app(token)
            logger.info("Telegram бот запускается...")
            _bot_app.run_polling(stop_signals=None)
        except Exception as e:
            logger.error(f"Telegram бот упал: {e}")

    _bot_thread = threading.Thread(target=_run, daemon=True, name="tg-bot")
    _bot_thread.start()
    logger.info("Telegram бот запущен в фоне")


def stop_bot():
    global _bot_app
    if _bot_app:
        try:
            _run_coro(_bot_app.stop())
        except Exception:
            pass
