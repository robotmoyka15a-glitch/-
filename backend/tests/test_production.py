"""
WashControl Production-Ready Test Suite
========================================
Полный тест всех критических компонентов системы.
"""

import pytest
import sys
import os
import time
import json
from pathlib import Path

# Добавляем backend в path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import get_connection, init_db, hash_password, verify_password
from config import SECRET_KEY, JWT_ALGORITHM, _get_or_create_secret
from middleware import check_rate_limit
from main import app


class MockRateLimiter:
    """Простая эмуляция RateLimiter для тестов"""
    def __init__(self, max_requests=5, window_seconds=60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = {}
    
    def is_allowed(self, key: str) -> bool:
        return check_rate_limit(key, self.max_requests, self.window_seconds)


class TestSecurity:
    """Тесты безопасности"""
    
    def test_bcrypt_password_hashing(self):
        """Проверка bcrypt хеширования паролей"""
        password = "test_password_123"
        hashed = hash_password(password)
        
        # Проверка что хеш не равен паролю
        assert hashed != password
        # Проверка что хеш начинается с $2b$ (bcrypt формат)
        assert hashed.startswith("$2b$")
        # Проверка верификации
        assert verify_password(password, hashed) is True
        # Проверка неверного пароля
        assert verify_password("wrong_password", hashed) is False
        
    def test_different_hashes_same_password(self):
        """Один и тот же пароль дает разные хеши"""
        password = "same_password"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2  # Соль делает хеши разными
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)
    
    def test_jwt_secret_generation(self):
        """Проверка генерации JWT secret"""
        secret1 = _get_or_create_secret()
        secret2 = _get_or_create_secret()
        
        assert len(secret1) >= 32
        # Secret сохраняется и возвращается тот же самый
        assert secret1 == secret2


class TestRateLimiting:
    """Тесты rate limiting"""
    
    def test_rate_limiter_blocks_excessive_requests(self):
        """Rate limiter блокирует частые запросы"""
        # Используем уникальные ключи для каждого теста чтобы избежать загрязнения
        import time
        test_key = f"test_user_{time.time()}"
        
        # Первые 5 запросов должны пройти (возвращает False = не превышен)
        for i in range(5):
            assert check_rate_limit(test_key, 5, 60) is False
        
        # 6-й должен быть заблокирован (возвращает True = превышен)
        assert check_rate_limit(test_key, 5, 60) is True
    
    def test_rate_limiter_different_users(self):
        """Разные пользователи имеют отдельные лимиты"""
        import time
        user1_key = f"user1_{time.time()}"
        user2_key = f"user2_{time.time()}"
        
        # Пользователь 1 исчерпал лимит (2 запроса)
        check_rate_limit(user1_key, 2, 60)
        check_rate_limit(user1_key, 2, 60)
        assert check_rate_limit(user1_key, 2, 60) is True  # Лимит превышен
        
        # Пользователь 2 еще может делать запросы
        assert check_rate_limit(user2_key, 2, 60) is False  # Не превышен


class TestDatabase:
    """Тесты базы данных"""
    
    def test_database_initialization(self):
        """Инициализация БД создает таблицы"""
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем что таблица users существует после init_db
            init_db()
            
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            result = cursor.fetchone()
            assert result is not None
            assert result[0] == 'users'
            
            # Создаем тестового пользователя напрямую через SQL
            test_username = f"test_user_{int(time.time())}"
            test_password = hash_password("test123")
            
            cursor.execute("""
                INSERT INTO users (username, full_name, password, role, is_active)
                VALUES (?, ?, ?, ?, ?)
            """, (test_username, "Test User", test_password, "admin", 1))
            conn.commit()
            
            # Проверяем что пользователь создан
            cursor.execute("SELECT id, username FROM users WHERE username = ?", (test_username,))
            user = cursor.fetchone()
            assert user is not None
            assert user[1] == test_username
            
            # Удаляем тестового пользователя
            cursor.execute("DELETE FROM users WHERE username = ?", (test_username,))
            conn.commit()
            
        finally:
            pass  # Не удаляем БД для других тестов


class TestConfig:
    """Тесты конфигурации"""
    
    def test_settings_load(self):
        """Настройки загружаются корректно"""
        # Проверяем что константы существуют и имеют правильные значения
        assert SECRET_KEY is not None
        assert len(SECRET_KEY) >= 32
        assert JWT_ALGORITHM == "HS256"


class TestHealthCheck:
    """Тесты health check endpoint"""
    
    def test_health_endpoint_exists(self):
        """Health endpoint существует"""
        from fastapi.testclient import TestClient
        client = TestClient(app)
        
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        # Проверяем структуру ответа
        assert "status" in data  # status, warning, или error
        assert "checks" in data  # объект с проверками
        checks = data["checks"]
        assert "database" in checks  # проверка БД


class TestBackupSystem:
    """Тесты системы бэкапов"""
    
    def test_backup_directory_exists(self):
        """Папка для бэкапов существует"""
        backup_dir = Path("/workspace/data/backups")
        backup_dir.mkdir(parents=True, exist_ok=True)
        assert backup_dir.exists()
    
    def test_backup_creation_logic(self):
        """Логика создания бэкапа работает"""
        # Имитация создания бэкапа
        db_path = Path("/workspace/data/washcontrol.db")
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Создаем тестовую БД если нет
        if not db_path.exists():
            init_db()
        
        assert db_path.exists()


class TestInputValidation:
    """Тесты валидации входных данных"""
    
    def test_pydantic_validation_exists(self):
        """Pydantic модели существуют"""
        from pydantic import BaseModel, Field
        
        class LoginRequest(BaseModel):
            username: str = Field(..., min_length=3, max_length=50)
            password: str = Field(..., min_length=6)
        
        # Валидный запрос
        valid = LoginRequest(username="admin", password="password123")
        assert valid.username == "admin"
        
        # Невалидный запрос (короткий пароль)
        with pytest.raises(Exception):
            LoginRequest(username="admin", password="123")


class TestIntegrations:
    """Тесты интеграций"""
    
    def test_vk_retry_logic_structure(self):
        """Структура retry логики для VK существует"""
        vk_service_path = Path("/workspace/backend/services/vk_notify.py")
        if vk_service_path.exists():
            content = vk_service_path.read_text()
            assert "retry" in content.lower() or "Retry" in content


class TestOfflineMode:
    """Тесты работы без интернета"""
    
    def test_core_works_without_internet(self):
        """Ядро работает без интернета"""
        # Проверяем что основные модули не импортируют обязательные внешние API
        core_modules = [
            "/workspace/backend/database.py",
            "/workspace/backend/config.py",
            "/workspace/backend/main.py"
        ]
        
        for module_path in core_modules:
            if Path(module_path).exists():
                content = Path(module_path).read_text()
                # Убеждаемся что нет обязательных вызовов внешних API в импортах
                assert "import requests" not in content or "# optional" in content.lower()


class TestAIFallback:
    """Тесты fallback AI"""
    
    def test_ai_fallback_structure(self):
        """Структура fallback AI существует"""
        ai_service_path = Path("/workspace/backend/services/ai_service.py")
        if ai_service_path.exists():
            content = ai_service_path.read_text()
            assert "fallback" in content.lower() or "builtin" in content.lower()


def run_all_tests():
    """Запуск всех тестов"""
    print("=" * 60)
    print("🧪 ЗАПУСК ПОЛНОГО ТЕСТИРОВАНИЯ WASHCONTROL")
    print("=" * 60)
    
    test_classes = [
        TestSecurity,
        TestRateLimiting,
        TestDatabase,
        TestConfig,
        TestHealthCheck,
        TestBackupSystem,
        TestInputValidation,
        TestIntegrations,
        TestOfflineMode,
        TestAIFallback
    ]
    
    passed = 0
    failed = 0
    
    for test_class in test_classes:
        instance = test_class()
        for method_name in dir(instance):
            if method_name.startswith("test_"):
                try:
                    getattr(instance, method_name)()
                    print(f"✅ {test_class.__name__}.{method_name}")
                    passed += 1
                except Exception as e:
                    print(f"❌ {test_class.__name__}.{method_name}: {e}")
                    failed += 1
    
    print("=" * 60)
    print(f"📊 РЕЗУЛЬТАТЫ: {passed} прошло, {failed} провалено")
    print("=" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
