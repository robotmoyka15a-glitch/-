"""
WashControl — роутер настроек
Чтение и запись всех параметров приложения
"""

from fastapi import APIRouter, Depends, HTTPException
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


@router.post("/backup/restore")
def restore_backup(body: dict, current_user: dict = Depends(require_admin)):
    """Восстановить базу данных из резервной копии."""
    import shutil
    from backend.config import DB_PATH, BACKUP_DIR
    
    filename = body.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="Не указано имя файла бэкапа")
    
    backup_path = BACKUP_DIR / filename
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail=f"Бэкап {filename} не найден")
    
    # Создаём временную копию текущей БД
    temp_backup = DB_PATH.with_suffix(DB_PATH.suffix + ".restore_temp")
    if DB_PATH.exists():
        shutil.copy2(str(DB_PATH), str(temp_backup))
    
    try:
        # Копируем бэкап поверх текущей БД
        shutil.copy2(str(backup_path), str(DB_PATH))
        
        # Удаляем WAL и SHM файлы чтобы избежать конфликтов
        wal_file = DB_PATH.with_suffix(DB_PATH.suffix + "-wal")
        shm_file = DB_PATH.with_suffix(DB_PATH.suffix + "-shm")
        if wal_file.exists():
            wal_file.unlink()
        if shm_file.exists():
            shm_file.unlink()
        
        # Удаляем временную копию
        if temp_backup.exists():
            temp_backup.unlink()
        
        return {"ok": True, "message": f"База данных восстановлена из {filename}. Требуется перезапуск сервиса."}
    except Exception as e:
        # Пытаемся откатить изменения при ошибке
        if temp_backup.exists():
            try:
                shutil.copy2(str(temp_backup), str(DB_PATH))
                temp_backup.unlink()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Ошибка восстановления: {e}")


@router.delete("/backup/delete/{filename}")
def delete_backup(filename: str, current_user: dict = Depends(require_admin)):
    """Удалить указанную резервную копию."""
    from backend.config import BACKUP_DIR
    from backend.routers.backups import list_backups as get_backups_list
    
    backup_path = BACKUP_DIR / filename
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail=f"Бэкап {filename} не найден")
    
    # Проверяем что это не последняя копия
    backups = get_backups_list()
    if len(backups) <= 1:
        raise HTTPException(status_code=400, detail="Нельзя удалить единственную резервную копию")
    
    latest_backup = next((b for b in backups if b.get('filename') == filename), None)
    if latest_backup:
        raise HTTPException(status_code=400, detail="Нельзя удалить последнюю резервную копию")
    
    try:
        backup_path.unlink()
        # Также удаляем WAL и SHM файлы если есть
        wal_file = backup_path.with_suffix(backup_path.suffix + "-wal")
        shm_file = backup_path.with_suffix(backup_path.suffix + "-shm")
        if wal_file.exists():
            wal_file.unlink()
        if shm_file.exists():
            shm_file.unlink()
        
        return {"ok": True, "message": f"Бэкап {filename} удалён"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка удаления: {e}")
