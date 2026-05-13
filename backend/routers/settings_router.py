"""
WashControl — роутер настроек
Чтение и запись всех параметров приложения
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.database import get_connection, get_all_settings, set_setting
from backend.routers.auth import require_admin

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsBatch(BaseModel):
    data: dict[str, str]


@router.get("")
def get_settings(current_user: dict = Depends(require_admin)):
    """Получить все настройки (только admin)."""
    settings = get_all_settings()
    # Скрываем пароли из ответа
    safe = {
        k: ("***" if "password" in k or "token" in k else v)
        for k, v in settings.items()
    }
    return safe


@router.put("")
def update_settings(body: SettingsBatch, current_user: dict = Depends(require_admin)):
    """Обновить несколько настроек за один запрос."""
    for key, value in body.data.items():
        set_setting(key, value)
    return {"ok": True, "updated": len(body.data)}


@router.get("/wash-modes")
def get_wash_modes():
    """Публичный эндпоинт — названия режимов мойки (нужны оператору)."""
    from backend.database import get_connection
    conn = get_connection()
    rows = conn.execute(
        "SELECT key, value FROM settings WHERE key LIKE 'wash_mode_%'"
    ).fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


@router.post("/backup")
def create_backup(current_user: dict = Depends(require_admin)):
    """Создать резервную копию БД вручную."""
    import shutil
    from datetime import datetime
    from backend.config import DB_PATH, BACKUP_DIR

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = BACKUP_DIR / f"washcontrol_backup_{ts}.db"
    shutil.copy2(str(DB_PATH), str(dst))
    return {"ok": True, "backup_file": dst.name}


@router.get("/backups")
def list_backups(current_user: dict = Depends(require_admin)):
    """Список резервных копий."""
    from backend.config import BACKUP_DIR
    from datetime import datetime
    import os

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(BACKUP_DIR.glob("*.db"), key=os.path.getmtime, reverse=True)
    return [
        {
            "filename":   f.name,
            "size_kb":    round(f.stat().st_size / 1024, 1),
            "created_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        }
        for f in files
    ]
