"""
WashControl — планировщик фоновых задач
Ночные отчёты, бэкапы, проверка опозданий
Использует APScheduler (лёгкий, без Redis/Celery)
"""

import logging
import shutil
import threading
from datetime import datetime, date
from pathlib import Path

logger = logging.getLogger("washcontrol.scheduler")

_scheduler = None


def _daily_report_job():
    """Отправляет ежедневный итоговый отчёт в конце дня."""
    try:
        from backend.services.ai_worker import generate_daily_summary
        from backend.services.telegram_bot import notify_admin
        from backend.services.vk_notify import send_daily_report
        from backend.database import get_connection
        from backend.config import WASH_MODES, PAYMENT_METHODS

        today = date.today().isoformat()
        conn = get_connection()
        stats = conn.execute(
            """SELECT COUNT(*) as cars,
                      COALESCE(SUM(amount+extra_amount),0) as revenue
               FROM cars c JOIN shifts s ON c.shift_id=s.id WHERE s.date=?""",
            (today,)
        ).fetchone()
        conn.close()

        summary = generate_daily_summary()
        report_txt = (
            f"📊 Итоги дня {today}\n"
            f"🚗 Машин: {stats['cars']}\n"
            f"💰 Выручка: {stats['revenue']:.0f} ₽\n\n"
            f"🤖 AI-сводка:\n{summary}"
        )
        notify_admin(report_txt)
        send_daily_report(report_txt)
        logger.info(f"Ежедневный отчёт отправлен ({today})")
    except Exception as e:
        logger.error(f"Ошибка ежедневного отчёта: {e}")


def _backup_job():
    """Создаёт резервную копию БД."""
    try:
        from backend.config import DB_PATH, BACKUP_DIR, BACKUP_KEEP_DAYS
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
        dst = BACKUP_DIR / f"washcontrol_backup_{ts}.db"
        shutil.copy2(str(DB_PATH), str(dst))
        logger.info(f"Бэкап создан: {dst.name}")

        # Удалить старые бэкапы
        import os
        cutoff = datetime.now().timestamp() - BACKUP_KEEP_DAYS * 86400
        for f in BACKUP_DIR.glob("*.db"):
            if f.stat().st_mtime < cutoff:
                f.unlink()
                logger.info(f"Старый бэкап удалён: {f.name}")
    except Exception as e:
        logger.error(f"Ошибка бэкапа: {e}")


def _check_late_shift():
    """Проверяет смены на опоздание и уведомляет."""
    try:
        from backend.database import get_connection, get_setting
        from backend.services.telegram_bot import notify_admin
        from backend.services.vk_notify import send_late_alert

        start_time = get_setting("shift_start_time", "08:00")
        threshold  = int(get_setting("late_threshold_min", "15"))
        today      = date.today().isoformat()
        now        = datetime.now()

        conn = get_connection()
        # Ищем пользователей без открытой смены после порогового времени
        users = conn.execute(
            "SELECT * FROM users WHERE role='operator' AND is_active=1"
        ).fetchall()

        hour, minute = map(int, start_time.split(":"))
        expected = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        late_check_time = expected.replace(minute=minute + threshold
                                           if minute + threshold < 60
                                           else minute + threshold - 60,
                                           hour=hour + (1 if minute + threshold >= 60 else 0))

        if now < late_check_time:
            conn.close()
            return  # ещё не время проверять

        for user in users:
            has_shift = conn.execute(
                "SELECT id FROM shifts WHERE user_id=? AND date=?",
                (user["id"], today)
            ).fetchone()
            already_notified = conn.execute(
                "SELECT id FROM events WHERE user_id=? AND event_type='late' "
                "AND created_at >= ?",
                (user["id"], today)
            ).fetchone()

            if not has_shift and not already_notified:
                msg = f"⚠️ {user['full_name']} не открыл смену! (>{threshold} мин опоздания)"
                notify_admin(msg)
                send_late_alert(user["full_name"], threshold)
                conn.execute(
                    "INSERT INTO events (user_id, event_type, title, source) VALUES (?,?,?,?)",
                    (user["id"], "late", msg, "system")
                )
                conn.commit()

        conn.close()
    except Exception as e:
        logger.error(f"Ошибка проверки опозданий: {e}")


def start_scheduler():
    """Запускает планировщик. Вызывается при старте приложения."""
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger

        _scheduler = BackgroundScheduler(timezone="Europe/Moscow")

        # Ежедневный отчёт в 23:15
        _scheduler.add_job(_daily_report_job, CronTrigger(hour=23, minute=15))

        # Бэкап каждую ночь в 03:00
        _scheduler.add_job(_backup_job, CronTrigger(hour=3, minute=0))

        # Проверка опозданий каждые 5 минут с 08:00 до 09:00
        _scheduler.add_job(
            _check_late_shift,
            CronTrigger(hour="8", minute="*/5")
        )

        _scheduler.start()
        logger.info("Планировщик задач запущен")
    except ImportError:
        logger.warning("APScheduler не установлен, фоновые задачи отключены")
    except Exception as e:
        logger.error(f"Ошибка запуска планировщика: {e}")


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Планировщик остановлен")
