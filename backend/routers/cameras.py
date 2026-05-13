"""
WashControl — роутер камер
Интеграция с TRASSIR: список каналов, скриншоты, отправка в Telegram
"""

import os
import time
import json
import httpx
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from backend.database import get_connection, get_setting
from backend.config import SCREENSHOTS_DIR
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/cameras", tags=["cameras"])


# ── TRASSIR HTTP API ──────────────────────────────────────────────────────────

class TrassirClient:
    """
    Клиент к TRASSIR SDK HTTP API.
    Документация: http://<host>:<port>/
    Порт по умолчанию 8080 (HTTP) или 8443 (HTTPS).
    """

    def __init__(self, host: str, port: int, login: str, password: str):
        self.base = f"http://{host}:{port}"
        self.login    = login
        self.password = password
        self._sid: Optional[str] = None

    def _md5(self, s: str) -> str:
        return hashlib.md5(s.encode()).hexdigest()

    def _get_sid(self) -> str:
        """Получить или обновить сессионный токен."""
        if self._sid:
            return self._sid
        url = f"{self.base}/login"
        params = {
            "username":   self.login,
            "password":   self._md5(self.password),
            "lang":       "ru",
        }
        r = httpx.get(url, params=params, timeout=8)
        data = r.json()
        if data.get("sid"):
            self._sid = data["sid"]
            return self._sid
        raise Exception(f"TRASSIR авторизация не удалась: {data}")

    def get_channels(self) -> list[dict]:
        """Список всех каналов (камер)."""
        sid = self._get_sid()
        r = httpx.get(
            f"{self.base}/objects/",
            params={"sid": sid, "type": "channel"},
            timeout=10,
        )
        data = r.json()
        channels = []
        for guid in data.get("objects", []):
            info = self.get_channel_info(guid)
            channels.append({"guid": guid, **info})
        return channels

    def get_channel_info(self, guid: str) -> dict:
        sid = self._get_sid()
        r = httpx.get(
            f"{self.base}/object/{guid}",
            params={"sid": sid},
            timeout=8,
        )
        return r.json()

    def screenshot(self, channel_guid: str) -> bytes:
        """Получить JPEG-скриншот с камеры."""
        sid = self._get_sid()
        r = httpx.get(
            f"{self.base}/screenshot/{channel_guid}",
            params={"sid": sid, "jpeg_quality": "80"},
            timeout=15,
        )
        if r.status_code != 200:
            raise Exception(f"Скриншот не получен: HTTP {r.status_code}")
        return r.content


def _get_client() -> Optional[TrassirClient]:
    """Возвращает клиент TRASSIR на основе настроек из БД."""
    host = get_setting("trassir_host")
    port = int(get_setting("trassir_port", "8080"))
    login = get_setting("trassir_login", "admin")
    pw = get_setting("trassir_password")
    if not host or not pw:
        return None
    return TrassirClient(host, port, login, pw)


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@router.get("/status")
def camera_status(current_user: dict = Depends(get_current_user)):
    """Проверить подключение к TRASSIR."""
    client = _get_client()
    if not client:
        return {"connected": False, "reason": "Не настроены параметры TRASSIR"}
    try:
        sid = client._get_sid()
        return {"connected": True, "sid_prefix": sid[:6] + "..."}
    except Exception as e:
        return {"connected": False, "reason": str(e)}


@router.get("/channels")
def list_channels(current_user: dict = Depends(get_current_user)):
    """Список доступных каналов (камер) в TRASSIR."""
    client = _get_client()
    if not client:
        raise HTTPException(status_code=503, detail="TRASSIR не настроен")
    try:
        return client.get_channels()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ошибка TRASSIR: {e}")


@router.post("/screenshot/{channel_guid}")
def take_screenshot(
    channel_guid: str,
    send_telegram: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """
    Сделать скриншот с указанной камеры.
    Сохраняет файл локально, опционально отправляет в Telegram.
    """
    client = _get_client()
    if not client:
        raise HTTPException(status_code=503, detail="TRASSIR не настроен")

    try:
        img_bytes = client.screenshot(channel_guid)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ошибка скриншота: {e}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename  = f"cam_{channel_guid[:8]}_{timestamp}.jpg"
    filepath  = SCREENSHOTS_DIR / filename
    filepath.write_bytes(img_bytes)

    # Событие в журнал
    conn = get_connection()
    conn.execute(
        """INSERT INTO events
           (user_id, event_type, title, body, source, screenshot)
           VALUES (?, 'camera', ?, ?, 'camera', ?)""",
        (
            current_user["id"],
            f"Скриншот камеры {channel_guid[:8]}",
            f"Снимок сохранён: {filename}",
            str(filepath),
        ),
    )
    conn.commit()
    conn.close()

    if send_telegram:
        try:
            from backend.services.telegram_bot import send_photo_sync
            send_photo_sync(str(filepath), caption=f"📷 Камера {channel_guid[:8]}\n{timestamp}")
        except Exception:
            pass  # не блокируем основной поток

    return {"ok": True, "filename": filename, "path": str(filepath)}


@router.get("/screenshot/file/{filename}")
def get_screenshot_file(filename: str, current_user: dict = Depends(get_current_user)):
    """Отдать сохранённый скриншот как изображение."""
    filepath = SCREENSHOTS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(str(filepath), media_type="image/jpeg")


@router.get("/screenshots")
def list_screenshots(
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
):
    """Список последних сохранённых скриншотов."""
    files = sorted(SCREENSHOTS_DIR.glob("*.jpg"), key=os.path.getmtime, reverse=True)
    result = []
    for f in files[:limit]:
        result.append({
            "filename": f.name,
            "size_kb":  round(f.stat().st_size / 1024, 1),
            "created_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        })
    return result
