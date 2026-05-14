"""
WashControl — Быстрая сборка Portable .exe
============================================
Запускать из корня проекта:
    python quick_build.py

Что делает:
  1. Собирает backend через PyInstaller (один .exe файл)
  2. Собирает frontend через Vite
  3. Создаёт portable-папку с готовым приложением
  4. Опционально: создаёт NSIS installer

Результат: 
  - build/washcontrol_portable/ — готовая portable версия
  - dist/WashControl-Setup.exe — установщик (опционально)
"""

import subprocess
import sys
import os
import shutil
import time
from pathlib import Path

ROOT = Path(__file__).parent
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"
BUILD_DIR = ROOT / "build"
DIST = ROOT / "dist"

# ── ANSI цвета ────────────────────────────────────────────────────────────────
RESET = "\033[0m"
BOLD = "\033[1m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
WHITE = "\033[97m"
DIM = "\033[2m"

def header(title: str):
    width = 60
    print(f"\n{CYAN}{BOLD}{'═' * width}")
    print(f"  {title}")
    print(f"{'═' * width}{RESET}")

def step(n: int, total: int, msg: str):
    print(f"\n{BOLD}{CYAN}[{n}/{total}]{RESET} {WHITE}{msg}{RESET}")

def ok(msg: str):
    print(f"  {GREEN}✔{RESET}  {msg}")

def warn(msg: str):
    print(f"  {YELLOW}⚠{RESET}  {msg}")

def info(msg: str):
    print(f"  {DIM}▸{RESET}  {msg}")

def error(msg: str, hint: str = ""):
    print(f"\n{RED}{BOLD}✘ ОШИБКА: {msg}{RESET}")
    if hint:
        print(f"{YELLOW}   Что делать: {hint}{RESET}")
    sys.exit(1)

def elapsed(start: float) -> str:
    s = time.time() - start
    return f"{s:.1f}s"

def run(cmd: str, cwd: Path = None, check: bool = True, hint: str = ""):
    """Запускает команду с выводом"""
    info(f"$ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=str(cwd or ROOT), text=True)
    if check and result.returncode != 0:
        error(f"Команда не удалась: {cmd}", hint=hint)
    return result

# ── Шаг 1: Проверка зависимостей ─────────────────────────────────────────────
def check_deps():
    start = time.time()
    step(1, 5, "Проверка зависимостей")
    
    # Python
    v = sys.version_info
    if v.major < 3 or v.minor < 10:
        error("Требуется Python 3.10+", "Установите Python 3.11+ с python.org")
    ok(f"Python {v.major}.{v.minor}.{v.micro}")
    
    # Node.js
    r = subprocess.run("node --version", shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        error("Node.js не найден", "Установите Node.js 18+ с nodejs.org")
    ok(f"Node.js {r.stdout.strip()}")
    
    # npm
    r2 = subprocess.run("npm --version", shell=True, capture_output=True, text=True)
    if r2.returncode != 0:
        error("npm не найден")
    ok(f"npm {r2.stdout.strip()}")
    
    ok(f"Проверка за {elapsed(start)}")

# ── Шаг 2: Установка зависимостей ────────────────────────────────────────────
def install_deps():
    start = time.time()
    step(2, 5, "Установка зависимостей")
    
    # Python зависимости
    req = ROOT / "requirements.txt"
    if req.exists():
        run(f'"{sys.executable}" -m pip install -r requirements.txt --quiet', 
            hint="Запустите от администратора или добавьте --user")
    else:
        warn("requirements.txt не найден")
    
    # PyInstaller
    run(f'"{sys.executable}" -m pip install pyinstaller --quiet')
    
    # Node зависимости
    run("npm install --legacy-peer-deps", cwd=FRONTEND,
        hint="Удалите node_modules и package-lock.json, затем повторите")
    
    ok(f"Зависимости готовы за {elapsed(start)}")

# ── Шаг 3: Сборка frontend ───────────────────────────────────────────────────
def build_frontend():
    start = time.time()
    step(3, 5, "Сборка frontend (Vite)")
    
    run("npm run build", cwd=FRONTEND,
        hint="Проверьте ошибки в выводе выше")
    
    dist_dir = FRONTEND / "dist"
    if not dist_dir.exists():
        error("Frontend не собран — папка dist не создана")
    
    ok(f"Frontend собран за {elapsed(start)}")

# ── Шаг 4: Сборка backend через PyInstaller ──────────────────────────────────
def build_backend():
    start = time.time()
    step(4, 5, "Сборка backend (PyInstaller)")
    
    # Создаём spec файл
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-
a = Analysis(
    ['backend/main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('data', 'data'),
        ('frontend/dist', 'frontend/dist'),
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
    name='washcontrol',
    debug=False,
    strip=False,
    upx=True,
    console=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name='washcontrol',
)
'''
    spec_path = ROOT / "washcontrol.spec"
    spec_path.write_text(spec_content, encoding="utf-8")
    
    # Собираем
    run(f'"{sys.executable}" -m PyInstaller washcontrol.spec --noconfirm --clean',
        hint="Проверьте hiddenimports в spec файле")
    
    # Копируем в build
    src = ROOT / "dist" / "washcontrol"
    if src.exists():
        if BUILD_DIR.exists():
            shutil.rmtree(BUILD_DIR)
        BUILD_DIR.mkdir(parents=True)
        
        portable_dir = BUILD_DIR / "washcontrol_portable"
        shutil.copytree(str(src), str(portable_dir))
        
        # Копируем дополнительные файлы
        for item in ["data", ".env.example"]:
            src_item = ROOT / item
            if src_item.exists():
                dst_item = portable_dir / item
                if src_item.is_dir():
                    if dst_item.exists():
                        shutil.rmtree(dst_item)
                    shutil.copytree(str(src_item), str(dst_item))
                else:
                    shutil.copy2(str(src_item), str(dst_item))
        
        ok(f"Backend собран в {portable_dir} за {elapsed(start)}")
    else:
        error("PyInstaller не создал exe файл")

# ── Шаг 5: Создание launcher.bat ─────────────────────────────────────────────
def create_launcher():
    start = time.time()
    step(5, 5, "Создание ярлыков и launcher")
    
    portable_dir = BUILD_DIR / "washcontrol_portable"
    
    # Создаём launcher.bat для portable версии
    launcher_content = '''@echo off
chcp 65001 > nul
title WashControl

cd /d "%~dp0"

echo Запуск WashControl...
start "" "washcontrol.exe"

echo.
echo WashControl запущен!
echo Сервер доступен по адресу: http://localhost:8000
echo.
echo Нажмите любую клавишу для выхода из этого окна...
pause > nul
'''
    launcher = portable_dir / "ЗАПУСТИТЬ.bat"
    launcher.write_text(launcher_content, encoding="utf-8")
    
    # README для portable версии
    readme_content = '''# WashControl — Portable версия

## Запуск
Просто запустите `washcontrol.exe` или `ЗАПУСТИТЬ.bat`

## Адрес в браузере
После запуска откройте: http://localhost:8000

## Данные
Все данные хранятся в папке `data/`

## Резервное копирование
Просто скопируйте всю папку `washcontrol_portable` в безопасное место.

## Требования
- Windows 10/11
- 2 GB RAM
- 500 MB свободного места
'''
    readme = portable_dir / "README.txt"
    readme.write_text(readme_content, encoding="utf-8")
    
    ok(f"Launcher создан за {elapsed(start)}")

# ── Финал ────────────────────────────────────────────────────────────────────
def print_summary():
    portable_exe = BUILD_DIR / "washcontrol_portable" / "washcontrol.exe"
    
    print(f"\n{GREEN}{BOLD}{'═' * 60}")
    print("  ✅ СБОРКА ЗАВЕРШЕНА УСПЕШНО!")
    print(f"{'═' * 60}{RESET}")
    
    if portable_exe.exists():
        size_mb = portable_exe.stat().st_size / (1024 * 1024)
        print(f"\n{WHITE}  Готовые файлы:{RESET}")
        print(f"  {GREEN}●{RESET}  {portable_exe}")
        print(f"     {DIM}Размер: {size_mb:.1f} МБ{RESET}")
        print(f"\n  {WHITE}  Portable версия:{RESET}")
        print(f"  {GREEN}●{RESET}  {BUILD_DIR / 'washcontrol_portable'}")
        print(f"     {DIM}Папка с готовым приложением — просто скопируйте куда нужно{RESET}")
    else:
        print(f"\n  {YELLOW}Файл не найден{RESET}")
    
    print(f"\n{DIM}  Общее время сборки завершено{RESET}\n")
    
    # Предложить открыть папку
    if portable_exe.exists():
        print(f"  {DIM}Откройте папку: {BUILD_DIR / 'washcontrol_portable'}{RESET}")
        print(f"  {DIM}И запустите ЗАПУСТИТЬ.bat{RESET}\n")

def main():
    total_start = time.time()
    
    header("WashControl — Быстрая сборка Portable .exe")
    print(f"  {DIM}Проект: {ROOT}{RESET}")
    print(f"  {DIM}Python: {sys.executable}{RESET}")
    print()
    
    check_deps()
    install_deps()
    build_frontend()
    build_backend()
    create_launcher()
    
    total = elapsed(total_start)
    print(f"\n{DIM}  Общее время: {total}{RESET}")
    print_summary()
    
    print("\n" + "="*60)
    print("📦 ЧТО ПОЛУЧИЛОСЬ:")
    print("="*60)
    print("1. Portable версия — просто скопируйте папку куда нужно")
    print("2. Один .exe файл внутри папки")
    print("3. Все данные в папке data/")
    print("4. Никакой установки не требуется!")
    print("="*60)

if __name__ == "__main__":
    main()
