"""
WashControl — скрипт сборки Windows .exe
=========================================
Запускать из корня проекта:
    python installer/build_windows.py

Что делает:
  1. Проверяет Python 3.10+ и Node.js 18+
  2. Устанавливает Python-зависимости (pip install -r requirements.txt)
  3. Скачивает/проверяет WinPython embeddable (для включения в пакет)
  4. npm install в frontend/
  5. npm run build  (vite build)
  6. electron-builder --win --x64
  7. Выводит путь к готовому .exe и его размер

Результат: dist/WashControl Setup 1.0.0.exe
"""

import subprocess
import sys
import os
import shutil
import time
import urllib.request
from pathlib import Path

ROOT     = Path(__file__).parent.parent
FRONTEND = ROOT / "frontend"
DIST     = ROOT / "dist"

# ── ANSI цвета ────────────────────────────────────────────────────────────────
RESET   = "\033[0m"
BOLD    = "\033[1m"
RED     = "\033[91m"
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
CYAN    = "\033[96m"
WHITE   = "\033[97m"
DIM     = "\033[2m"

# ── Утилиты вывода ────────────────────────────────────────────────────────────

def header(title: str):
    width = 56
    print(f"\n{CYAN}{BOLD}{'─' * width}")
    print(f"  {title}")
    print(f"{'─' * width}{RESET}")


def step(n: int, total: int, msg: str):
    print(f"\n{BOLD}{CYAN}[{n}/{total}]{RESET} {WHITE}{msg}{RESET}")


def ok(msg: str):
    print(f"  {GREEN}✔  {msg}{RESET}")


def warn(msg: str):
    print(f"  {YELLOW}⚠  {msg}{RESET}")


def info(msg: str):
    print(f"  {DIM}▸  {msg}{RESET}")


def error(msg: str, hint: str = ""):
    print(f"\n{RED}{BOLD}✘  ОШИБКА: {msg}{RESET}")
    if hint:
        print(f"{YELLOW}   Что делать: {hint}{RESET}")
    sys.exit(1)


def elapsed(start: float) -> str:
    s = time.time() - start
    return f"{s:.1f}s"


def human_size(path: Path) -> str:
    if not path.exists():
        return "?"
    mb = path.stat().st_size / (1024 * 1024)
    return f"{mb:.1f} МБ"


# ── Запуск команды ────────────────────────────────────────────────────────────

def run(cmd: str, cwd: Path = None, check: bool = True,
        hint_on_fail: str = "") -> subprocess.CompletedProcess:
    """Запускает команду, печатает её и проверяет код возврата."""
    info(f"$ {cmd}")
    result = subprocess.run(
        cmd, shell=True,
        cwd=str(cwd or ROOT),
        text=True,
    )
    if check and result.returncode != 0:
        error(
            f"Команда завершилась с кодом {result.returncode}:\n   {cmd}",
            hint=hint_on_fail or "Проверьте вывод выше для деталей.",
        )
    return result


# ── Шаг 1: Проверка зависимостей ─────────────────────────────────────────────

def check_requirements():
    start = time.time()
    step(1, 6, "Проверка системных зависимостей")

    # Python версия
    v = sys.version_info
    if v.major < 3 or (v.major == 3 and v.minor < 10):
        error(
            f"Требуется Python 3.10+. Установлен: {v.major}.{v.minor}",
            hint="Скачайте Python 3.11+ с https://python.org и перезапустите.",
        )
    ok(f"Python {v.major}.{v.minor}.{v.micro}")

    # Node.js версия
    r = subprocess.run("node --version", shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        error(
            "Node.js не найден.",
            hint="Скачайте Node.js 18 LTS с https://nodejs.org и перезапустите.",
        )
    node_ver = r.stdout.strip().lstrip("v")
    major = int(node_ver.split(".")[0]) if node_ver.split(".")[0].isdigit() else 0
    if major < 18:
        warn(f"Node.js {node_ver} — рекомендуется 18+. Продолжаем, но могут быть проблемы.")
    else:
        ok(f"Node.js {node_ver}")

    # npm
    r2 = subprocess.run("npm --version", shell=True, capture_output=True, text=True)
    if r2.returncode != 0:
        error("npm не найден.", hint="npm устанавливается вместе с Node.js.")
    ok(f"npm {r2.stdout.strip()}")

    ok(f"Проверка завершена за {elapsed(start)}")


# ── Шаг 2: Python зависимости ─────────────────────────────────────────────────

def install_python_deps():
    start = time.time()
    step(2, 6, "Установка Python-зависимостей")

    req = ROOT / "requirements.txt"
    if not req.exists():
        warn("requirements.txt не найден, пропускаем pip install")
    else:
        run(
            f'"{sys.executable}" -m pip install -r requirements.txt --quiet --disable-pip-version-check',
            hint_on_fail=(
                "Попробуйте запустить скрипт от имени администратора "
                "или добавьте флаг --user к pip install."
            ),
        )

    # PyInstaller нужен для упаковки backend
    run(
        f'"{sys.executable}" -m pip install pyinstaller --quiet --disable-pip-version-check',
        hint_on_fail="Убедитесь в наличии интернет-соединения.",
    )

    ok(f"Python-зависимости готовы ({elapsed(start)})")


# ── Шаг 3: WinPython embeddable ───────────────────────────────────────────────
# Если нужно включить Python в инсталлятор без требования установки от пользователя

WINPYTHON_URL = (
    "https://github.com/winpython/winpython/releases/download/"
    "7.0.20240203final/Winpython64-3.11.8.0dot.exe"
)
WINPYTHON_DEST = FRONTEND / "winpython_embed.exe"


def prepare_winpython():
    start = time.time()
    step(3, 6, "Проверка встроенного Python (WinPython embeddable)")

    # Проверяем, есть ли уже встроенный python в bundled_backend
    bundled_py = FRONTEND / "bundled_backend" / "washcontrol_server.exe"
    if bundled_py.exists():
        ok(f"Bundled backend уже существует, пропускаем скачивание ({elapsed(start)})")
        return

    # Проверяем, нужен ли вообще WinPython (только для production-сборки без PyInstaller)
    if WINPYTHON_DEST.exists():
        ok(f"WinPython embeddable уже скачан: {WINPYTHON_DEST.name} ({elapsed(start)})")
        return

    warn("WinPython embeddable не найден. Backend будет упакован через PyInstaller.")
    info("Для включения standalone Python: скачайте WinPython вручную:")
    info(f"  {WINPYTHON_URL}")
    info(f"  и сохраните как: {WINPYTHON_DEST}")
    ok(f"Шаг пропущен ({elapsed(start)})")


# ── Шаг 4: npm install ────────────────────────────────────────────────────────

def install_node_deps():
    start = time.time()
    step(4, 6, "Установка Node.js зависимостей (npm install)")

    run(
        "npm install --legacy-peer-deps",
        cwd=FRONTEND,
        hint_on_fail=(
            "Попробуйте удалить папку node_modules и package-lock.json, "
            "затем запустите снова."
        ),
    )
    ok(f"Node.js зависимости установлены ({elapsed(start)})")


# ── Шаг 5: vite build + PyInstaller ─────────────────────────────────────────

def build_frontend():
    start = time.time()
    step(5, 6, "Сборка frontend (vite build) + backend (PyInstaller)")

    # 5a. Vite build
    info("Запуск: npm run build")
    run(
        "npm run build",
        cwd=FRONTEND,
        hint_on_fail=(
            "Ошибка сборки Vite. Проверьте вывод выше. "
            "Часто помогает удалить node_modules и переустановить зависимости."
        ),
    )
    dist_dir = FRONTEND / "dist"
    if not dist_dir.exists():
        error("Сборка frontend провалилась — папка dist не создана.")
    ok("Frontend (React/Vite) собран")

    # 5b. PyInstaller
    info("Запуск: PyInstaller backend...")
    spec_content = """\
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

    run(
        f'"{sys.executable}" -m PyInstaller washcontrol.spec --noconfirm --clean',
        hint_on_fail=(
            "Убедитесь что PyInstaller установлен: pip install pyinstaller. "
            "Если ошибка в импортах — добавьте модуль в hiddenimports."
        ),
    )

    bundled = FRONTEND / "bundled_backend"
    if bundled.exists():
        shutil.rmtree(bundled)

    src = ROOT / "dist" / "washcontrol_server"
    if src.exists():
        shutil.copytree(str(src), str(bundled))
        ok("Backend скопирован в frontend/bundled_backend")
    else:
        warn("PyInstaller: папка dist/washcontrol_server не найдена — backend запустится через python")

    ok(f"Шаг 5 завершён за {elapsed(start)}")


# ── Шаг 6: electron-builder ──────────────────────────────────────────────────

def build_electron_installer():
    start = time.time()
    step(6, 6, "Сборка Electron NSIS инсталлятора (electron-builder)")

    run(
        "npx electron-builder --win --x64",
        cwd=FRONTEND,
        hint_on_fail=(
            "Убедитесь что electron-builder установлен (npm install --save-dev electron-builder). "
            "При ошибке NSIS — установите NSIS вручную и добавьте в PATH."
        ),
    )

    ok(f"electron-builder завершён за {elapsed(start)}")


# ── Финальный отчёт ───────────────────────────────────────────────────────────

def print_summary():
    output_dirs = [
        ROOT / "dist",
        FRONTEND / "dist_electron",
        FRONTEND / "release",
    ]

    found_exes = []
    for d in output_dirs:
        if d.exists():
            found_exes.extend(d.glob("*.exe"))

    print(f"\n{GREEN}{BOLD}{'═' * 56}")
    print("  ✅  СБОРКА ЗАВЕРШЕНА УСПЕШНО!")
    print(f"{'═' * 56}{RESET}")

    if found_exes:
        print(f"\n{WHITE}  Готовые файлы:{RESET}")
        for exe in found_exes:
            size = human_size(exe)
            print(f"  {GREEN}●{RESET}  {exe}")
            print(f"     {DIM}Размер: {size}{RESET}")
    else:
        print(f"\n  {YELLOW}Файлы .exe не найдены в стандартных папках.{RESET}")
        print(f"  Проверьте: {ROOT / 'dist'}")

    # Автоматически открыть папку dist
    dist_to_open = ROOT / "dist"
    if dist_to_open.exists() and found_exes:
        print(f"\n  {DIM}Открываем папку dist...{RESET}")
        try:
            if sys.platform == "win32":
                subprocess.Popen(f'explorer "{dist_to_open}"')
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(dist_to_open)])
            else:
                subprocess.Popen(["xdg-open", str(dist_to_open)])
        except Exception as e:
            warn(f"Не удалось открыть папку: {e}")

    print(f"\n{DIM}  Проект: {ROOT}{RESET}\n")


# ── Точка входа ───────────────────────────────────────────────────────────────

def main():
    total_start = time.time()

    header("WashControl — Сборка Windows .exe  (одна кнопка)")
    print(f"  {DIM}Проект: {ROOT}{RESET}")
    print(f"  {DIM}Python: {sys.executable}{RESET}")

    check_requirements()
    install_python_deps()
    prepare_winpython()
    install_node_deps()
    build_frontend()
    build_electron_installer()

    total = elapsed(total_start)
    print(f"\n{DIM}  Общее время: {total}{RESET}")
    print_summary()


if __name__ == "__main__":
    main()
