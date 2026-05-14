"""
WashControl — Backup & Restore API
Создание, восстановление и управление резервными копиями базы данных
"""

import os
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from backend.database import get_connection, DB_PATH
from backend.config import BACKUP_DIR, BACKUP_KEEP_DAYS
from backend.routers.auth import require_admin

router = APIRouter(prefix="/backup", tags=["backup"])


# ── Pydantic схемы ────────────────────────────────────────────────────────────

class BackupInfo(BaseModel):
    filename: str
    filepath: str
    size_bytes: int
    created_at: str
    is_latest: bool = False


class BackupResponse(BaseModel):
    ok: bool
    message: str
    backup: BackupInfo | None = None


class RestoreRequest(BaseModel):
    filename: str


# ── Вспомогательные функции ───────────────────────────────────────────────────

def get_backup_filename() -> str:
    """Генерирует имя файла бэкапа с датой и временем."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"washcontrol_{timestamp}.db"


def calculate_backup_size(filepath: str) -> int:
    """Возвращает размер файла в байтах."""
    try:
        return os.path.getsize(filepath)
    except OSError:
        return 0


def cleanup_old_backups():
    """Удаляет старые бэкапы старше BACKUP_KEEP_DAYS дней."""
    if not BACKUP_DIR.exists():
        return
    
    cutoff = datetime.now().timestamp() - (BACKUP_KEEP_DAYS * 24 * 60 * 60)
    
    for file in BACKUP_DIR.glob("washcontrol_*.db"):
        try:
            mtime = file.stat().st_mtime
            if mtime < cutoff:
                file.unlink()
                # Также удаляем WAL и SHM файлы если есть
                wal_file = file.with_suffix(file.suffix + "-wal")
                shm_file = file.with_suffix(file.suffix + "-shm")
                if wal_file.exists():
                    wal_file.unlink()
                if shm_file.exists():
                    shm_file.unlink()
        except Exception as e:
            print(f"[Backup] Не удалось удалить старый бэкап {file}: {e}")


def list_backups() -> List[BackupInfo]:
    """Возвращает список всех бэкапов."""
    backups = []
    
    if not BACKUP_DIR.exists():
        return backups
    
    # Получаем все .db файлы
    db_files = sorted(
        BACKUP_DIR.glob("washcontrol_*.db"),
        key=lambda x: x.stat().st_mtime,
        reverse=True
    )
    
    latest_name = db_files[0].name if db_files else None
    
    for db_file in db_files:
        info = BackupInfo(
            filename=db_file.name,
            filepath=str(db_file),
            size_bytes=calculate_backup_size(str(db_file)),
            created_at=datetime.fromtimestamp(db_file.stat().st_mtime).isoformat(),
            is_latest=(db_file.name == latest_name)
        )
        backups.append(info)
    
    return backups


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@router.post("/create", response_model=BackupResponse)
def create_backup(current_user: dict = Depends(require_admin)):
    """
    Создать резервную копию базы данных.
    Только для администраторов.
    """
    try:
        # Закрываем все активные соединения перед бэкапом
        conn = get_connection()
        
        # Используем backup API SQLite для консистентного бэкапа
        backup_filename = get_backup_filename()
        backup_path = BACKUP_DIR / backup_filename
        
        # Создаём резервную копию
        backup_conn = sqlite3.connect(str(backup_path))
        conn.backup(backup_conn)
        backup_conn.close()
        
        # Очищаем старые бэкапы
        cleanup_old_backups()
        
        # Возвращаем информацию о созданном бэкапе
        backups = list_backups()
        latest_backup = next((b for b in backups if b.is_latest), None)
        
        return BackupResponse(
            ok=True,
            message=f"Бэкап успешно создан: {backup_filename}",
            backup=latest_backup
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка создания бэкапа: {e}")


@router.get("/list", response_model=List[BackupInfo])
def list_backups_endpoint(current_user: dict = Depends(require_admin)):
    """
    Получить список всех резервных копий.
    Только для администраторов.
    """
    return list_backups()


@router.post("/restore", response_model=BackupResponse)
def restore_backup(request: RestoreRequest, current_user: dict = Depends(require_admin)):
    """
    Восстановить базу данных из резервной копии.
    Только для администраторов.
    Требует перезапуска сервиса после восстановления.
    """
    backup_path = BACKUP_DIR / request.filename
    
    # Проверяем существование файла
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail=f"Бэкап {request.filename} не найден")
    
    # Проверяем что это валидный файл бэкапа
    if not request.filename.startswith("washcontrol_") or not request.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Неверный формат имени файла бэкапа")
    
    try:
        # Создаём временную копию текущей БД на случай отката
        temp_backup = DB_PATH.with_suffix(DB_PATH.suffix + ".restore_temp")
        if DB_PATH.exists():
            shutil.copy2(str(DB_PATH), str(temp_backup))
        
        # Копируем бэкап поверх текущей БД
        shutil.copy2(str(backup_path), str(DB_PATH))
        
        # Удаляем WAL и SHM файлы чтобы избежать конфликтов
        wal_file = DB_PATH.with_suffix(DB_PATH.suffix + "-wal")
        shm_file = DB_PATH.with_suffix(DB_PATH.suffix + "-shm")
        if wal_file.exists():
            wal_file.unlink()
        if shm_file.exists():
            shm_file.unlink()
        
        # Удаляем временную копию если всё успешно
        if temp_backup.exists():
            temp_backup.unlink()
        
        return BackupResponse(
            ok=True,
            message=f"База данных восстановлена из {request.filename}. Требуется перезапуск сервиса.",
            backup=None
        )
    
    except Exception as e:
        # Пытаемся откатить изменения при ошибке
        temp_backup = DB_PATH.with_suffix(DB_PATH.suffix + ".restore_temp")
        if temp_backup.exists():
            try:
                shutil.copy2(str(temp_backup), str(DB_PATH))
                temp_backup.unlink()
            except Exception:
                pass
        
        raise HTTPException(status_code=500, detail=f"Ошибка восстановления: {e}")


@router.delete("/delete/{filename}", response_model=dict)
def delete_backup(filename: str, current_user: dict = Depends(require_admin)):
    """
    Удалить указанную резервную копию.
    Только для администраторов.
    Нельзя удалить последнюю копию.
    """
    backup_path = BACKUP_DIR / filename
    
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail=f"Бэкап {filename} не найден")
    
    # Проверяем что это не последняя копия
    backups = list_backups()
    if len(backups) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить единственную резервную копию"
        )
    
    latest_backup = next((b for b in backups if b.is_latest), None)
    if latest_backup and latest_backup.filename == filename:
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить последнюю резервную копию"
        )
    
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


@router.get("/stats", tags=["system"])
def backup_stats(current_user: dict = Depends(require_admin)):
    """
    Получить статистику по бэкапам.
    Только для администраторов.
    """
    backups = list_backups()
    total_size = sum(b.size_bytes for b in backups)
    
    return {
        "count": len(backups),
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "latest_backup": backups[0].created_at if backups else None,
        "oldest_backup": backups[-1].created_at if backups else None,
        "keep_days": BACKUP_KEEP_DAYS,
    }
