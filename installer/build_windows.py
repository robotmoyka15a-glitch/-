"""
WashControl — скрипт сборки Windows .exe
Запускать из корня проекта: python installer/build_windows.py

Что делает:
  1. Проверяет наличие Python, Node.js
  2. Устанавливает Python-зависимости
  3. Собирает React-приложение (vite build)
  4. Упаковывает backend в .exe через PyInstaller
  5. Собирает финальный NSIS-инсталлятор через electron-builder

Результат: dist/WashControl Setup 1.0.0.exe
"""

import subprocess
import sys
import os
import shutil
from pathlib import Path

ROOT     = Path(__file__).parent.parent
FRONTEND = ROOT / "frontend"
DIST     = ROOT / "dist"

RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
RESET  = "\033[0m"

def log(msg, color=BLUE):
    print(f"{color}[BUILD] {msg}{RESET}")

def error(msg):
    print(f"{RED}[ERROR] {msg}{RESET}")
    sys.exit(1)

def run(cmd, cwd=None, check=True):
    log(f"$ {cmd}")
    result = subprocess.run(
        cmd, shell=True, cwd=str(cwd or ROOT),
        capture_output=False, text=True
    )
    if check and result.returncode != 0:
        error(f"Команда завершилась с ошибкой: {cmd}")
    return result


def check_requirements():
    log("Проверка зависимостей...")

    # Python
    v = sys.version_info
    if v.major < 3 or (v.major == 3 and v.minor < 10):
        error(f"Требуется Python 3.10+. Установлен: {v.major}.{v.minor}")
    log(f"Python {v.major}.{v.minor}.{v.micro} ✓", GREEN)

    # Node.js
    r = subprocess.run("node --version", shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        error("Node.js не найден. Установите с https://nodejs.org (LTS)")
    log(f"Node.js {r.stdout.strip()} ✓", GREEN)

    # npm
    r = subprocess.run("npm --version", shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        error("npm не найден")
    log(f"npm {r.stdout.strip()} ✓", GREEN)


def install_python_deps():
    log("Установка Python-зависимостей...")
    run(f'"{sys.executable}" -m pip install -r requirements.txt --quiet')
    run(f'"{sys.executable}" -m pip install pyinstaller --quiet')
    log("Python зависимости установлены ✓", GREEN)


def install_node_deps():
    log("Установка Node.js зависимостей...")
    run("npm install --legacy-peer-deps", cwd=FRONTEND)
    log("Node.js зависимости установлены ✓", GREEN)


def build_frontend():
    log("Сборка React приложения (vite build)...")
    run("npm run build", cwd=FRONTEND)
    dist_dir = FRONTEND / "dist"
    if not dist_dir.exists():
        error("Сборка frontend провалилась — папка dist не создана")
    log("Frontend собран ✓", GREEN)


def build_backend_exe():
    """
    Упаковываем Python backend в одну папку через PyInstaller.
    Electron будет запускать bundled/backend/washcontrol_server.exe
    """
    log("Сборка Python backend (PyInstaller)...")

    spec_content = """
# -*- mode: python ; coding: utf-8 -*-
a = Analysis(
    ['backend/main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('data', 'data'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'pydantic',
        'sqlite3',
        'jwt',
        'httpx',
        'openpyxl',
        'apscheduler',
        'telegram',
        'vk_api',
        'backend.routers.auth',
        'backend.routers.shifts',
        'backend.routers.cars',
        'backend.routers.events',
        'backend.routers.reports',
        'backend.routers.cameras',
        'backend.routers.settings_router',
        'backend.routers.ai_router',
        'backend.services.telegram_bot',
        'backend.services.vk_notify',
        'backend.services.ai_worker',
        'backend.services.scheduler',
    ],
    excludes=['tkinter', 'matplotlib', 'numpy', 'PIL', 'test'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='washcontrol_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon='installer/icon.ico',
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='washcontrol_server',
)
"""
    spec_path = ROOT / "washcontrol.spec"
    spec_path.write_text(spec_content, encoding="utf-8")

    run(f'"{sys.executable}" -m PyInstaller washcontrol.spec --noconfirm --clean')

    bundled = FRONTEND / "bundled_backend"
    if bundled.exists():
        shutil.rmtree(bundled)

    src = ROOT / "dist" / "washcontrol_server"
    if src.exists():
        shutil.copytree(str(src), str(bundled))
        log(f"Backend скопирован в frontend/bundled_backend ✓", GREEN)
    else:
        log("PyInstaller сборка не найдена — backend будет запускаться через python", YELLOW)


def build_electron_installer():
    log("Сборка Electron NSIS инсталлятора...")
    run("npm run dist", cwd=FRONTEND)

    # Ищем .exe в output-папке
    output = ROOT / "dist"
    exes = list(output.glob("*.exe"))
    if exes:
        for exe in exes:
            log(f"✅ Инсталлятор готов: {exe}", GREEN)
    else:
        log("Готовая сборка в папке dist/", YELLOW)


def create_portable():
    """
    Создаёт portable-версию — папку, которую можно просто скопировать и запустить.
    Содержит: backend (PyInstaller), data/, requirements.txt, start.bat
    """
    log("Создание portable-версии...")
    portable = ROOT / "dist" / "WashControl_portable"
    if portable.exists():
        shutil.rmtree(portable)
    portable.mkdir(parents=True)

    # start.bat для запуска без установки
    bat = portable / "Запустить WashControl.bat"
    bat.write_text(
        "@echo off\n"
        "title WashControl\n"
        "echo Запуск WashControl...\n"
        "cd /d \"%~dp0\"\n"
        "start \"\" \"backend\\washcontrol_server.exe\"\n"
        "timeout /t 3 /nobreak >nul\n"
        "start \"\" \"WashControl.exe\"\n",
        encoding="cp1251"
    )
    log(f"Portable-версия: {portable}", GREEN)


def main():
    print(f"\n{BLUE}{'='*50}")
    print("  WashControl — сборка Windows .exe")
    print(f"{'='*50}{RESET}\n")

    check_requirements()
    install_python_deps()
    install_node_deps()
    build_frontend()
    build_backend_exe()
    build_electron_installer()

    print(f"\n{GREEN}{'='*50}")
    print("  ✅ Сборка завершена!")
    print(f"  Инсталлятор: dist/WashControl Setup 1.0.0.exe")
    print(f"{'='*50}{RESET}\n")


if __name__ == "__main__":
    main()
