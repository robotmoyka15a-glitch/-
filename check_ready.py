"""
WashControl — Проверка готовности к сборке
============================================
Запуск: python check_ready.py

Проверяет все зависимости и готовность проекта к сборке .exe
"""

import subprocess
import sys
import shutil
from pathlib import Path

ROOT = Path(__file__).parent

# Цвета
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

def check(name: str, condition: bool, hint: str = ""):
    status = f"{GREEN}✔{RESET}" if condition else f"{RED}✘{RESET}"
    print(f"  {status}  {name}")
    if not condition and hint:
        print(f"       {YELLOW}→ {hint}{RESET}")
    return condition

def main():
    print(f"\n{CYAN}{BOLD}{'═' * 60}")
    print("  WASHCONTROL — ПРОВЕРКА ГОТОВНОСТИ К СБОРКЕ")
    print(f"{'═' * 60}{RESET}\n")
    
    all_ok = True
    
    # Python
    v = sys.version_info
    py_ok = v.major >= 3 and v.minor >= 10
    all_ok &= check(
        f"Python {v.major}.{v.minor}.{v.micro}",
        py_ok,
        "Установите Python 3.11+ с python.org" if not py_ok else ""
    )
    
    # Node.js
    r = subprocess.run("node --version", shell=True, capture_output=True, text=True)
    node_ok = r.returncode == 0
    node_ver = r.stdout.strip() if node_ok else "не найден"
    all_ok &= check(
        f"Node.js {node_ver}",
        node_ok,
        "Установите Node.js 18+ с nodejs.org" if not node_ok else ""
    )
    
    # npm
    r2 = subprocess.run("npm --version", shell=True, capture_output=True, text=True)
    npm_ok = r2.returncode == 0
    npm_ver = r2.stdout.strip() if npm_ok else "не найден"
    all_ok &= check(
        f"npm {npm_ver}",
        npm_ok,
        "npm устанавливается с Node.js" if not npm_ok else ""
    )
    
    # requirements.txt
    req = ROOT / "requirements.txt"
    req_ok = req.exists()
    all_ok &= check(
        "requirements.txt",
        req_ok,
        "Файл не найден в корне проекта" if not req_ok else ""
    )
    
    # backend/main.py
    main_py = ROOT / "backend" / "main.py"
    main_ok = main_py.exists()
    all_ok &= check(
        "backend/main.py",
        main_ok,
        "Главный файл backend не найден" if not main_ok else ""
    )
    
    # frontend/package.json
    pkg_json = ROOT / "frontend" / "package.json"
    pkg_ok = pkg_json.exists()
    all_ok &= check(
        "frontend/package.json",
        pkg_ok,
        "Frontend не настроен" if not pkg_ok else ""
    )
    
    # data/ папка
    data_dir = ROOT / "data"
    data_ok = data_dir.exists() and data_dir.is_dir()
    all_ok &= check(
        "data/ (папка данных)",
        data_ok,
        "Создайте папку data/" if not data_ok else ""
    )
    
    # Проверка установленных pip пакетов
    print(f"\n  {BOLD}Python пакеты:{RESET}")
    
    required_packages = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("pydantic", "pydantic"),
        ("sqlalchemy", "sqlalchemy"),
        ("bcrypt", "bcrypt"),
        ("python-jose", "jose"),
        ("httpx", "httpx"),
        ("apscheduler", "apscheduler"),
    ]
    
    for pkg_name, import_name in required_packages:
        r = subprocess.run(
            f'"{sys.executable}" -c "import {import_name}"',
            shell=True,
            capture_output=True
        )
        installed = r.returncode == 0
        check(pkg_name, installed, f"pip install {pkg_name}" if not installed else "")
        all_ok &= installed
    
    # Проверка node_modules
    node_modules = ROOT / "frontend" / "node_modules"
    nm_ok = node_modules.exists()
    all_ok &= check(
        "frontend/node_modules",
        nm_ok,
        "Выполните: cd frontend && npm install" if not nm_ok else ""
    )
    
    # Итог
    print(f"\n{CYAN}{BOLD}{'─' * 60}{RESET}")
    
    if all_ok:
        print(f"\n  {GREEN}{BOLD}✅ ВСЁ ГОТОВО К СБОРКЕ!{RESET}\n")
        print(f"  Запустите один из вариантов:")
        print(f"    1. {BOLD}СОБРАТЬ_ПРИЛОЖЕНИЕ.bat{RESET}  (рекомендуется)")
        print(f"    2. {BOLD}python quick_build.py{RESET}")
        print(f"    3. {BOLD}installer/build.bat{RESET}  (полный installer)")
        print()
    else:
        print(f"\n  {RED}{BOLD}⚠️ НАЙДЕНЫ ПРОБЛЕМЫ{RESET}")
        print(f"  Устраните их перед сборкой (см. подсказки выше)\n")
        print(f"  Для автоматической установки зависимостей:")
        print(f"    {CYAN}pip install -r requirements.txt{RESET}")
        print(f"    {CYAN}cd frontend && npm install{RESET}")
        print()
    
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
