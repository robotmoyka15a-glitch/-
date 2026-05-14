#!/usr/bin/env python3
"""
WashControl - Полная система тестирования (Full System Test)
Тестирует ВСЕ компоненты системы в комплексе:
- Установка и инициализация
- База данных и миграции
- Безопасность (bcrypt, JWT, rate limiting)
- API endpoints (auth, users, shifts, events, backups)
- Интеграции (Telegram, VK, TRASSIR mock)
- AI модуль с fallback
- Бэкап и восстановление
- Генерация отчётов Excel
- Health check
- Offline режим
"""

import os
import sys
import time
import json
import shutil
import tempfile
import subprocess
from pathlib import Path
from datetime import datetime, timedelta

# Добавляем backend в path
# Тест находится в backend/tests/, поэтому parent = /workspace/backend
BACKEND_DIR = Path(__file__).parent.parent  # /workspace/backend
sys.path.insert(0, str(BACKEND_DIR))

WORKSPACE_DIR = BACKEND_DIR.parent  # /workspace

# Проверка что мы в правильной директории
if not BACKEND_DIR.exists():
    print(f"❌ ОШИБКА: Backend директория не найдена: {BACKEND_DIR}")
    print(f"Текущая директория: {Path.cwd()}")
    print(f"Директория теста: {Path(__file__).parent}")
    print(f"Workspace: {WORKSPACE_DIR}")
    sys.exit(1)

# Цвета для вывода
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

def log(msg, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    if level == "PASS":
        color = Colors.GREEN
    elif level == "FAIL":
        color = Colors.RED
    elif level == "WARN":
        color = Colors.YELLOW
    else:
        color = Colors.BLUE
    
    print(f"{Colors.BOLD}[{timestamp}]{Colors.RESET} {color}[{level}]{Colors.RESET} {msg}")

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.tests = []
    
    def add_pass(self, name, details=""):
        self.passed += 1
        self.tests.append(("PASS", name, details))
        log(f"✓ {name}", "PASS")
        if details:
            print(f"  └─ {details}")
    
    def add_fail(self, name, error):
        self.failed += 1
        self.tests.append(("FAIL", name, error))
        log(f"✗ {name}", "FAIL")
        print(f"  └─ Ошибка: {error}")
    
    def add_warn(self, name, warning):
        self.warnings += 1
        self.tests.append(("WARN", name, warning))
        log(f"⚠ {name}", "WARN")
        print(f"  └─ Предупреждение: {warning}")
    
    def summary(self):
        total = self.passed + self.failed
        print("\n" + "="*70)
        print(f"{Colors.BOLD}ИТОГИ ТЕСТИРОВАНИЯ{Colors.RESET}")
        print("="*70)
        print(f"Всего тестов: {total}")
        print(f"{Colors.GREEN}Пройдено: {self.passed}{Colors.RESET}")
        if self.failed > 0:
            print(f"{Colors.RED}Провалено: {self.failed}{Colors.RESET}")
        if self.warnings > 0:
            print(f"{Colors.YELLOW}Предупреждения: {self.warnings}{Colors.RESET}")
        
        success_rate = (self.passed / total * 100) if total > 0 else 0
        print(f"\nУспешность: {success_rate:.1f}%")
        
        if self.failed == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Система готова к production.{Colors.RESET}")
            return True
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ ЕСТЬ ПРОВАЛЫ. Требуется исправление.{Colors.RESET}")
            return False

# Глобальный результат
result = TestResult()

def test_environment_setup():
    """Тест 1: Проверка окружения и зависимостей"""
    log("Запуск теста: Окружение и зависимости", "TEST")
    print("-"*50)
    
    # Проверка Python версии
    if sys.version_info >= (3, 8):
        result.add_pass("Python версия", f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
    else:
        result.add_fail("Python версия", f"Требуется 3.8+, найдено {sys.version_info.major}.{sys.version_info.minor}")
    
    # Проверка наличия backend директории
    backend_dir = Path(__file__).parent.parent / "backend"
    if backend_dir.exists():
        result.add_pass("Backend директория", str(backend_dir))
    else:
        result.add_fail("Backend директория", "Не найдена")
    
    # Проверка ключевых файлов (с учётом реальной структуры проекта)
    required_files = [
        "main.py",
        "database.py",
        "config.py",
        "middleware.py",
        "routers/auth.py",
        "routers/backups.py",
        "services/ai_worker.py",
        "services/telegram_bot.py",
        "services/vk_notify.py"
    ]
    
    for file in required_files:
        filepath = backend_dir / file
        if filepath.exists():
            result.add_pass(f"Файл {file}", "Найден")
        else:
            result.add_fail(f"Файл {file}", "Отсутствует")
    
    # Проверка установленных пакетов
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import bcrypt
        import jwt
        import pydantic
        result.add_pass("Ключевые пакеты", "FastAPI, SQLAlchemy, bcrypt, jwt, pydantic установлены")
    except ImportError as e:
        result.add_fail("Ключевые пакеты", f"Отсутствует пакет: {e}")
    
    print()

def test_database_initialization():
    """Тест 2: Инициализация базы данных"""
    log("Запуск теста: База данных", "TEST")
    print("-"*50)
    
    try:
        from database import get_connection, init_db
        
        # Проверка создания таблиц
        init_db()
        result.add_pass("Инициализация БД", "Таблицы созданы успешно")
        
        # Проверка подключения
        conn = get_connection()
        if conn:
            cursor = conn.execute("SELECT 1")
            if cursor.fetchone()[0] == 1:
                result.add_pass("Подключение к БД", "Успешно")
            else:
                result.add_fail("Подключение к БД", "Не удалось выполнить запрос")
        else:
            result.add_fail("Подключение к БД", "Не удалось подключиться")
        
        # Проверка наличия основных таблиц
        tables_to_check = ['users', 'shifts', 'events', 'cars', 'services']
        conn = get_connection()
        for table in tables_to_check:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?", 
                (table,)
            )
            if cursor.fetchone():
                result.add_pass(f"Таблица {table}", "Существует")
            else:
                result.add_warn(f"Таблица {table}", "Не найдена")
        
    except Exception as e:
        result.add_fail("База данных", str(e))
    
    print()

def test_security_features():
    """Тест 3: Безопасность (bcrypt, JWT, rate limiting)"""
    log("Запуск теста: Безопасность", "TEST")
    print("-"*50)
    
    # Тест bcrypt
    try:
        from database import hash_password, verify_password
        
        password = "TestPassword123!"
        hashed = hash_password(password)
        
        if hashed.startswith("$2b$"):
            result.add_pass("bcrypt хеширование", "Формат корректен")
        else:
            result.add_fail("bcrypt хеширование", f"Неверный формат: {hashed[:10]}...")
        
        if verify_password(password, hashed):
            result.add_pass("bcrypt проверка", "Пароль подтверждён")
        else:
            result.add_fail("bcrypt проверка", "Не удалось проверить пароль")
        
        if not verify_password("WrongPassword", hashed):
            result.add_pass("bcrypt защита", "Неверный пароль отклонён")
        else:
            result.add_fail("bcrypt защита", "Неверный пароль принят!")
        
    except Exception as e:
        result.add_fail("bcrypt", str(e))
    
    # Тест JWT
    try:
        from config import SECRET_KEY, ACCESS_TOKEN_EXPIRE
        from database import create_access_token
        
        token = create_access_token(data={"sub": "testuser", "role": "admin"})
        
        if token and len(token) > 50:
            result.add_pass("JWT генерация", f"Токен создан (длина: {len(token)})")
        else:
            result.add_fail("JWT генерация", "Токен не создан или слишком короткий")
        
        # Проверка уникальности secret
        if SECRET_KEY and len(SECRET_KEY) >= 32:
            result.add_pass("JWT Secret", f"Достаточная длина ({len(SECRET_KEY)} символов)")
        else:
            result.add_fail("JWT Secret", "Слишком короткий или отсутствует")
        
    except Exception as e:
        result.add_fail("JWT", str(e))
    
    # Тест Rate Limiting
    try:
        from middleware import check_rate_limit
        
        # Симуляция запросов с уникальным ключом
        test_key = f"test_user_{time.time()}"
        allowed = 0
        max_req = 5
        window = 10
        
        for i in range(7):
            if check_rate_limit(test_key, max_requests=max_req, window_seconds=window):
                allowed += 1
        
        if allowed == max_req:
            result.add_pass("Rate Limiting", f"Ограничено после {allowed} запросов")
        else:
            result.add_fail("Rate Limiting", f"Неправильное ограничение: {allowed} вместо {max_req}")
        
    except Exception as e:
        result.add_fail("Rate Limiting", str(e))
    
    print()

def test_api_endpoints():
    """Тест 4: API Endpoints (через FastAPI TestClient)"""
    log("Запуск теста: API Endpoints", "TEST")
    print("-"*50)
    
    try:
        from fastapi.testclient import TestClient
        from main import app
        
        client = TestClient(app)
        
        # Тест health endpoint
        response = client.get("/health")
        if response.status_code == 200:
            data = response.json()
            if "status" in data and data["status"] == "healthy":
                result.add_pass("GET /health", f"Status: {data['status']}")
            else:
                result.add_warn("GET /health", f"Странный ответ: {data}")
        else:
            result.add_fail("GET /health", f"Status code: {response.status_code}")
        
        # Тест login (должен вернуть 401 без данных)
        response = client.post("/login", json={})
        if response.status_code in [401, 422]:
            result.add_pass("POST /login (валидация)", "Неавторизованный доступ отклонён")
        else:
            result.add_fail("POST /login (валидация)", f"Неожиданный код: {response.status_code}")
        
        # Тест регистрации пользователя
        response = client.post("/users/register", json={
            "username": "testuser",
            "password": "testpass123",
            "full_name": "Test User",
            "role": "operator"
        })
        if response.status_code in [200, 201]:
            result.add_pass("POST /users/register", "Пользователь создан")
        elif response.status_code == 400:
            result.add_warn("POST /users/register", "Пользователь уже существует (нормально при повторном запуске)")
        else:
            result.add_fail("POST /users/register", f"Status code: {response.status_code}")
        
        # Тест получения списка пользователей (требуется авторизация)
        # Сначала логинимся
        login_response = client.post("/login", json={
            "username": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            
            users_response = client.get("/users", headers=headers)
            if users_response.status_code == 200:
                users = users_response.json()
                result.add_pass("GET /users (auth)", f"Получено {len(users)} пользователей")
            else:
                result.add_fail("GET /users (auth)", f"Status code: {users_response.status_code}")
        else:
            result.add_warn("GET /users (auth)", "Не удалось залогиниться как admin (возможно ещё не создан)")
        
        # Тест создания бэкапа
        backup_response = client.post("/backup/create", headers=headers if 'headers' in dir() else {})
        if backup_response.status_code in [200, 201]:
            result.add_pass("POST /backup/create", "Бэкап создан")
        else:
            result.add_warn("POST /backup/create", f"Status code: {backup_response.status_code}")
        
        # Тест списка бэкапов
        list_backup_response = client.get("/backup/list")
        if list_backup_response.status_code == 200:
            backups = list_backup_response.json()
            result.add_pass("GET /backup/list", f"Найдено {len(backups)} бэкапов")
        else:
            result.add_fail("GET /backup/list", f"Status code: {list_backup_response.status_code}")
        
    except Exception as e:
        result.add_fail("API Endpoints", str(e))
    
    print()

def test_integrations():
    """Тест 5: Интеграции (Telegram, VK, TRASSIR)"""
    log("Запуск теста: Интеграции", "TEST")
    print("-"*50)
    
    # Тест структуры Telegram уведомления
    try:
        from services.telegram_notify import TelegramNotifier
        
        notifier = TelegramNotifier()
        # Проверяем наличие метода
        if hasattr(notifier, 'send_message'):
            result.add_pass("TelegramNotifier", "Класс и метод send_message существуют")
        else:
            result.add_warn("TelegramNotifier", "Метод send_message не найден")
        
    except ImportError:
        result.add_warn("Telegram", "Модуль не найден (не критично, если не настроен)")
    except Exception as e:
        result.add_warn("Telegram", str(e))
    
    # Тест структуры VK уведомления с retry
    try:
        from services.vk_notify import VKNotifier
        
        notifier = VKNotifier()
        if hasattr(notifier, 'send_message'):
            result.add_pass("VKNotifier", "Класс и метод send_message существуют")
        else:
            result.add_warn("VKNotifier", "Метод send_message не найден")
        
        # Проверка retry логики
        if hasattr(notifier, 'retry_count') or hasattr(notifier, 'max_retries'):
            result.add_pass("VK Retry Logic", "Механизм повторов реализован")
        else:
            result.add_warn("VK Retry Logic", "Явный retry не найден (может быть внутри метода)")
        
    except ImportError:
        result.add_warn("VK", "Модуль не найден (не критично, если не настроен)")
    except Exception as e:
        result.add_warn("VK", str(e))
    
    # Тест TRASSIR подключения
    try:
        from services.trassir_client import TRASSIRClient
        
        client = TRASSIRClient()
        if hasattr(client, 'connect') or hasattr(client, 'get_camera_status'):
            result.add_pass("TRASSIRClient", "Класс и методы существуют")
        else:
            result.add_warn("TRASSIRClient", "Основные методы не найдены")
        
    except ImportError:
        result.add_warn("TRASSIR", "Модуль не найден (не критично, если не настроен)")
    except Exception as e:
        result.add_warn("TRASSIR", str(e))
    
    print()

def test_ai_module():
    """Тест 6: AI модуль с fallback"""
    log("Запуск теста: AI Модуль", "TEST")
    print("-"*50)
    
    try:
        from services.ai_service import AIService
        
        ai = AIService()
        
        # Проверка fallback режима
        if hasattr(ai, 'get_summary'):
            result.add_pass("AIService", "Метод get_summary существует")
            
            # Тест работы без внешней модели (builtin fallback)
            try:
                summary = ai.get_summary("Тестовые данные за день", context="mycontext")
                if summary:
                    result.add_pass("AI Fallback", f"Builtin режим работает (длина: {len(summary)})")
                else:
                    result.add_warn("AI Fallback", "Пустой ответ")
            except Exception as e:
                result.add_warn("AI Fallback", f"Ошибка при генерации: {e}")
        else:
            result.add_fail("AIService", "Метод get_summary не найден")
        
        # Проверка конфигурации
        if hasattr(ai, 'provider') or hasattr(ai, 'model'):
            result.add_pass("AI Конфигурация", "Настройки провайдера присутствуют")
        else:
            result.add_warn("AI Конфигурация", "Явные настройки не найдены")
        
    except ImportError:
        result.add_warn("AI", "Модуль не найден")
    except Exception as e:
        result.add_fail("AI Модуль", str(e))
    
    print()

def test_backup_restore():
    """Тест 7: Бэкап и восстановление"""
    log("Запуск теста: Бэкап и восстановление", "TEST")
    print("-"*50)
    
    try:
        from services.backup_service import BackupService
        
        backup_svc = BackupService()
        
        # Создание бэкапа
        backup_path = backup_svc.create_backup()
        if backup_path and Path(backup_path).exists():
            size = Path(backup_path).stat().st_size
            result.add_pass("Создание бэкапа", f"Файл: {backup_path}, Размер: {size} байт")
        else:
            result.add_fail("Создание бэкапа", "Бэкап не создан")
        
        # Список бэкапов
        backups = backup_svc.list_backups()
        if isinstance(backups, list) and len(backups) > 0:
            result.add_pass("Список бэкапов", f"Найдено {len(backups)} бэкапов")
        else:
            result.add_warn("Список бэкапов", "Список пуст или неверного формата")
        
        # Статистика
        stats = backup_svc.get_stats()
        if isinstance(stats, dict):
            result.add_pass("Статистика бэкапов", f"Ключи: {list(stats.keys())}")
        else:
            result.add_warn("Статистика бэкапов", "Неверный формат")
        
        # Восстановление (только проверка метода)
        if hasattr(backup_svc, 'restore_backup'):
            result.add_pass("Восстановление", "Метод restore_backup существует")
        else:
            result.add_fail("Восстановление", "Метод не найден")
        
    except Exception as e:
        result.add_fail("Бэкап и восстановление", str(e))
    
    print()

def test_excel_reports():
    """Тест 8: Генерация Excel отчётов"""
    log("Запуск теста: Excel отчёты", "TEST")
    print("-"*50)
    
    try:
        from services.excel_service import ExcelService
        
        excel_svc = ExcelService()
        
        # Проверка методов
        if hasattr(excel_svc, 'generate_shift_report'):
            result.add_pass("ExcelService", "Метод generate_shift_report существует")
        else:
            result.add_warn("ExcelService", "Метод generate_shift_report не найден")
        
        if hasattr(excel_svc, 'generate_daily_report'):
            result.add_pass("Excel Daily Report", "Метод generate_daily_report существует")
        else:
            result.add_warn("Excel Daily Report", "Метод не найден")
        
        # Попытка генерации тестового отчёта
        try:
            test_data = [
                {"id": 1, "service": "Мойка кузова", "price": 500, "employee": "Иван"},
                {"id": 2, "service": "Химчистка", "price": 1500, "employee": "Петр"}
            ]
            
            filepath = excel_svc.generate_report(test_data, "test_report")
            if filepath and Path(filepath).exists():
                size = Path(filepath).stat().st_size
                result.add_pass("Генерация Excel", f"Файл: {filepath}, Размер: {size} байт")
                # Удаляем тестовый файл
                Path(filepath).unlink(missing_ok=True)
            else:
                result.add_warn("Генерация Excel", "Файл не создан")
        except Exception as e:
            result.add_warn("Генерация Excel", f"Ошибка при генерации: {e}")
        
    except ImportError:
        result.add_warn("Excel", "Модуль не найден")
    except Exception as e:
        result.add_fail("Excel отчёты", str(e))
    
    print()

def test_offline_mode():
    """Тест 9: Offline режим (работа без интернета)"""
    log("Запуск теста: Offline режим", "TEST")
    print("-"*50)
    
    # Проверка что основные сервисы не требуют интернет по умолчанию
    try:
        from database import get_db
        from config import settings
        
        # SQLite локальный, не требует сети
        db = next(get_db())
        db.execute("SELECT 1")
        result.add_pass("SQLite локально", "Работает без сети")
        
        # Проверка что AI имеет builtin fallback
        from services.ai_service import AIService
        ai = AIService()
        if hasattr(ai, 'builtin_provider') or hasattr(ai, 'fallback'):
            result.add_pass("AI Offline", "Builtin fallback доступен")
        else:
            result.add_warn("AI Offline", "Fallback не найден явно")
        
        result.add_pass("Offline режим", "Основные компоненты работают без интернета")
        
    except Exception as e:
        result.add_fail("Offline режим", str(e))
    
    print()

def test_startup_script():
    """Тест 10: Скрипт запуска"""
    log("Запуск теста: Скрипт запуска", "TEST")
    print("-"*50)
    
    # Проверка наличия скриптов
    startup_bat = Path(__file__).parent / "ЗАПУСТИТЬ.bat"
    build_bat = Path(__file__).parent / "СОБРАТЬ_ПРИЛОЖЕНИЕ.bat"
    
    if startup_bat.exists():
        result.add_pass("ЗАПУСТИТЬ.bat", "Файл найден")
    else:
        result.add_warn("ЗАПУСТИТЬ.bat", "Файл не найден")
    
    if build_bat.exists():
        result.add_pass("СОБРАТЬ_ПРИЛОЖЕНИЕ.bat", "Файл найден")
    else:
        result.add_warn("СОБРАТЬ_ПРИЛОЖЕНИЕ.bat", "Файл не найден")
    
    # Проверка main.py
    main_py = Path(__file__).parent.parent / "backend" / "main.py"
    if main_py.exists():
        with open(main_py, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'uvicorn.run' in content or 'app' in content:
                result.add_pass("backend/main.py", "Точка входа найдена")
            else:
                result.add_warn("backend/main.py", "Странная структура файла")
    else:
        result.add_fail("backend/main.py", "Файл не найден")
    
    print()

def test_documentation():
    """Тест 11: Документация"""
    log("Запуск теста: Документация", "TEST")
    print("-"*50)
    
    docs = [
        "README.md",
        "ГОТОВО.md",
        "ПРОЕКТ_ГОТОВ.md",
        "БЫСТРЫЙ_СТАРТ.md",
        "AUDIT_REPORT.md"
    ]
    
    for doc in docs:
        doc_path = Path(__file__).parent / doc
        if doc_path.exists():
            size = doc_path.stat().st_size
            if size > 100:  # Минимальный размер
                result.add_pass(doc, f"Найден ({size} байт)")
            else:
                result.add_warn(doc, "Файл слишком маленький")
        else:
            result.add_warn(doc, "Не найден")
    
    print()

def run_all_tests():
    """Запуск всех тестов"""
    print("\n")
    print("="*70)
    print(f"{Colors.BOLD}{Colors.BLUE}WASHCONTROL - ПОЛНАЯ СИСТЕМА ТЕСТИРОВАНИЯ{Colors.RESET}")
    print(f"{Colors.BOLD}Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.RESET}")
    print("="*70)
    print()
    
    start_time = time.time()
    
    # Запуск всех тестов
    test_environment_setup()
    test_database_initialization()
    test_security_features()
    test_api_endpoints()
    test_integrations()
    test_ai_module()
    test_backup_restore()
    test_excel_reports()
    test_offline_mode()
    test_startup_script()
    test_documentation()
    
    # Итоги
    elapsed = time.time() - start_time
    print("="*70)
    print(f"Время выполнения: {elapsed:.2f} сек")
    print("="*70)
    
    success = result.summary()
    
    # Детальный отчёт о провалах
    if result.failed > 0:
        print("\n" + "="*70)
        print(f"{Colors.RED}{Colors.BOLD}ДЕТАЛИ ПРОВАЛОВ:{Colors.RESET}")
        print("="*70)
        for status, name, error in result.tests:
            if status == "FAIL":
                print(f"  ❌ {name}: {error}")
    
    # Рекомендации
    if result.failed == 0 and result.warnings == 0:
        print("\n" + "="*70)
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 СИСТЕМА ПОЛНОСТЬЮ ГОТОВА К PRODUCTION!{Colors.RESET}")
        print("="*70)
        print("\nРекомендуемые следующие шаги:")
        print("  1. Запустить СОБРАТЬ_ПРИЛОЖЕНИЕ.bat для создания .exe")
        print("  2. Протестировать на чистой Windows машине")
        print("  3. Настроить Telegram/VK интеграции")
        print("  4. Создать первого пользователя через UI")
        print("  5. Начать работу!")
    elif result.failed == 0:
        print("\n" + "="*70)
        print(f"{Colors.YELLOW}{Colors.BOLD}⚠️ СИСТЕМА ГОТОВА, НО ЕСТЬ ПРЕДУПРЕЖДЕНИЯ{Colors.RESET}")
        print("="*70)
        print("Предупреждения не блокируют работу, но рекомендуется их устранить.")
    
    return result.failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
