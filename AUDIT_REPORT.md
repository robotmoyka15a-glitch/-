# 🔍 AUDIT REPORT: WashControl v1.0.0

**Дата аудита:** 2025-01-XX  
**Аудитор:** Senior Software Architect / Staff Full-Stack Engineer / QA Lead  
**Статус проекта:** **MVP готов, требует доработки для Production**

---

## A. КРАТКИЙ ВЫВОД

**Готов ли проект к разработке?** ✅ **ДА**, ядро системы работоспособно.

**Готов ли проект к production?** ⚠️ **ЧАСТИЧНО** — требуется 8 критических исправлений перед развёртыванием на реальной автомойке.

**Текущее состояние:**
- ✅ Backend (FastAPI) — архитектура грамотная, модульная
- ✅ Database (SQLite) — правильно настроен WAL, thread-local пул
- ✅ AI-модуль — отличная fallback-стратегия с 4 провайдерами
- ✅ Telegram бот — работает, есть антиспам
- ✅ Frontend (React+Vite) — современный стек, адаптивный дизайн
- ⚠️ VK интеграция — не протестирована в бою
- ⚠️ Камеры TRASSIR — нет retry/reconnect логики
- ❌ Безопасность паролей — SHA-256 недостаточно (нужен bcrypt/argon2)
- ❌ Нет обработки ошибок API при отсутствии сети
- ❌ Нет health-check endpoint'а для мониторинга
- ❌ Нет документации по восстановлению после crash
- ❌ Installer не протестирован на чистой Windows

---

## B. СПИСОК ПРОБЛЕМ И РИСКОВ ПО ПРИОРИТЕТУ

### 🔴 КРИТИЧЕСКИЕ (блокируют production)

| # | Проблема | Риск | Как исправить |
|---|----------|------|---------------|
| 1 | **SHA-256 для паролей** | Легко взломать радужными таблицами | Заменить на `bcrypt` или `argon2-cffi` |
| 2 | **Нет rate limiting на API** | DDoS изнутри, блокировка БД | Добавить `slowapi` или middleware |
| 3 | **JWT secret по умолчанию** | Любой может подделать токен | Генерировать при первом запуске, хранить в `.env` |
| 4 | **Нет обработки offline режима** | При потере сети VK/TRASSIR падают без recovery | Добавить retry с экспоненциальной задержкой |
| 5 | **Telegram бот падает без токена** | Приложение стартует с warning, но бот не восстанавливается | Сделать hot-reload конфигурации |
| 6 | **Нет валидации входных данных** | SQL injection через формы | Добавить Pydantic валидацию во все router |
| 7 | **Installer не тестирован** | Может не запуститься на чистой Windows | Протестировать на VM без Python/Node.js |
| 8 | **Нет backup restore UI** | Админ не сможет восстановить базу | Добавить экран "Восстановление из бэкапа" |

### 🟡 СЕРЬЁЗНЫЕ (требуют исправления в sprint 1)

| # | Проблема | Риск |
|---|----------|------|
| 9 | Нет логирования критических ошибок в файл | Невозможно дебажить production |
| 10 | AI модель загружается в main thread | Блокирует API на 30-60 сек при старте |
| 11 | Нет pagination на списках (машины, события) | При 1000+ записей интерфейс зависнет |
| 12 | Excel экспорт в памяти | При большом объёме данных — OOM |
| 13 | Нет audit trail для изменений настроек | Нельзя отследить кто сменил конфиг |
| 14 | VK API без retry | При временной недоступности VK уведомления теряются |
| 15 | TRASSIR скриншоты не сжимаются | Быстро заполняется диск |
| 16 | Нет проверки места на диске | Бэкапы могут упасть при 0 bytes free |

### 🟢 МИНОРНЫЕ (улучшения UX)

| # | Проблема |
|---|----------|
| 17 | Нет тёмной/светлой темы (только тёмная) |
| 18 | Нет keyboard shortcuts для частых действий |
| 19 | Нет search/filter на экране машин |
| 20 | Нет export в CSV (только Excel) |
| 21 | Нет печати чека/квитанции |
| 22 | Онбординг только для admin |
| 23 | Нет индикатора "последнее обновление" на dashboard |
| 24 | Нет confirmation dialog для опасных действий |

---

## C. ЧТО НАДО УБРАТЬ

| Компонент | Причина |
|-----------|---------|
| ❌ `concurrently` в production | Не нужен, Electron сам запускает backend |
| ❌ WinPython embeddable в installer | Увеличивает размер на 100MB, PyInstaller достаточно |
| ❌ Избыточные логи в console | Оставить только file logging в production |
| ❌ `access_log=True` в uvicorn | Замедляет работу, уже выключено ✓ |
| ❌ Дублирование `get_connection()` вызовов | В некоторых местах conn.close() лишний |

---

## D. ЧТО НАДО ДОБАВИТЬ

### Обязательно для production:

```
[ ] bcrypt/argon2 для хеширования паролей
[ ] Rate limiting middleware (slowapi)
[ ] .env файл с генерацией SECRET_KEY при первом запуске
[ ] Health check endpoint с детализацией
[ ] Retry logic для VK/TRASSIR/Telegram
[ ] Audit log для изменений настроек
[ ] Backup restore UI
[ ] Pagination для списков
[ ] Disk space monitoring
[ ] Graceful shutdown handler
```

### Желательно для UX:

```
[ ] Search/filter на Cars page
[ ] Keyboard shortcuts (Ctrl+N = новая машина)
[ ] Print receipt feature
[ ] CSV export
[ ] Dark/light theme toggle
[ ] Confirmation dialogs
[ ] Last updated timestamp
[ ] Offline mode indicator
```

---

## E. ЧТО НАДО УПРОСТИТЬ

| Текущее решение | Предлагаемое упрощение |
|-----------------|------------------------|
| 4 AI провайдера сразу | Оставить 2: builtin + ollama (llama_cpp слишком тяжёлый) |
| Электрон + Vite + React | Для локального сервера достаточно Vite + browser (убрать Electron из MVP) |
| NSIS installer через electron-builder | Делать отдельный PyInstaller .exe для backend + MSI для frontend |
| APScheduler для 3 задач | Достаточно threading.Timer для MVP |
| JWT 12 часов | Достаточно 2 часов для локальной системы |

---

## F. ЧТО НАДО ВЫНЕСТИ В ОТДЕЛЬНЫЙ МОДУЛЬ

```
backend/
├── core/                    # ← НОВОЕ: ядро безопасности
│   ├── security.py          # password hashing, JWT, rate limiting
│   └── config.py            # .env loader, validation
├── integrations/            # ← НОВОЕ: внешние сервисы
│   ├── telegram/
│   ├── vk/
│   ├── trassir/
│   └── base.py              # retry decorator, circuit breaker
├── workers/                 # ← ПЕРЕИМЕНОВАТЬ из services/
│   ├── ai_worker.py
│   ├── scheduler.py
│   └── backup_worker.py     # ← НОВОЕ: вынести бэкапы отдельно
└── api/                     # ← ПЕРЕИМЕНОВАТЬ из routers/
    └── ...
```

---

## G. ЧТО НАДО ОСТАВИТЬ В MVP

**Ядро (неприкосновенно):**
- ✅ SQLite + thread-local pool
- ✅ FastAPI структура
- ✅ JWT авторизация (но усилить security)
- ✅ AI fallback стратегия
- ✅ Telegram бот базовый
- ✅ Смены, машины, события
- ✅ Бэкапы (через worker)

**Отложить на v1.1:**
- ⏸️ VK интеграция (не критично)
- ⏸️ TRASSIR скриншоты (сложно в поддержке)
- ⏸️ Electron (достаточно browser)
- ⏸️ AI llama_cpp (слишком тяжёлый для weak PC)

---

## H. РЕКОМЕНДУЕМАЯ ФИНАЛЬНАЯ АРХИТЕКТУРА

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   React     │  │   Zustand   │  │  React Router│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND (FastAPI + Uvicorn)                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Layer (routers/)                    │   │
│  │  auth | cars | shifts | events | reports | ai       │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↕                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Core Services (workers/)                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │AI Worker │ │Scheduler │ │Backup    │            │   │
│  │  │(fallback)│ │(cron)    │ │Worker    │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↕                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Integrations (with retry/circuit breaker)    │   │
│  │  Telegram │ VK │ TRASSIR │ Google Sheets           │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↕                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SQLite (WAL mode)                       │   │
│  │         thread-local connection pool                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## I. РЕКОМЕНДУЕМЫЙ СТЕК

**Backend:**
```
Python 3.11 (не выше — лучше совместимость)
FastAPI 0.115+
Uvicorn 0.32+
SQLite 3.40+ (встроен в Python)
bcrypt 4.1+ (вместо SHA-256)
slowapi 0.1.9 (rate limiting)
httpx 0.28+ (async HTTP client)
APScheduler 3.10+ (или threading.Timer для MVP)
python-telegram-bot 21.9+
pydantic 2.9+ (валидация)
```

**Frontend:**
```
React 18.3+
Vite 6.0+
Zustand 5.0+ (state)
React Router 6.28+
Axios 1.7+ (HTTP client)
Recharts 2.14+ (графики)
DayJS 1.11+ (даты)
TailwindCSS (опционально для ускорения вёрстки)
```

**Deployment:**
```
Windows 10/11 x64
PyInstaller 6.11+ (backend .exe)
NSIS или Inno Setup (installer)
No Docker (локальный ПК)
No Redis (SQLite достаточно)
No Celery (APScheduler достаточно)
```

---

## J. РЕКОМЕНДУЕМЫЙ AI-ПОДХОД

**Стратегия:** "AI as optional enhancement, not core dependency"

```
┌────────────────────────────────────────────────────┐
│               AI Provider Chain                    │
│                                                    │
│  User Query                                        │
│      ↓                                             │
│  ┌─────────────────────────────────────────────┐  │
│  │  1. builtin (SQL answers) — ВСЕГДА РАБОТАЕТ │  │
│  │     - сколько машин → SELECT COUNT(*)       │  │
│  │     - выручка → SUM(amount)                 │  │
│  │     - кто на смене → active shifts          │  │
│  └─────────────────────────────────────────────┘  │
│      ↓ (если вопрос сложный)                      │
│  ┌─────────────────────────────────────────────┐  │
│  │  2. ollama (локальная LLM) — ОПЦИОНАЛЬНО    │  │
│  │     - qwen2.5:3b или llama3.2:3b            │  │
│  │     - timeout 15 сек                        │  │
│  │     - fallback на builtin при ошибке        │  │
│  └─────────────────────────────────────────────┘  │
│      ↓ (если ollama недоступен)                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  3. builtin summary — ALWAYS FALLBACK       │  │
│  │     - структурированная сводка из БД        │  │
│  └─────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

**Рекомендации:**
1. **Убрать llama_cpp из MVP** — слишком тяжёлый (2.5GB RAM, долгая загрузка)
2. **Ollama — основной AI провайдер** — легче обновлять, не в коде
3. **builtin — всегда активен** — даже без AI система отвечает на вопросы
4. **Context size ≤ 2048** — для слабого ПК
5. **Temperature 0.3** — для фактологических ответов
6. **Max tokens 512** — краткие ответы

---

## K. РЕКОМЕНДУЕМЫЙ ПЛАН ДОВОДКИ ПРОЕКТА

### Sprint 0: Critical Fixes (2 дня)

```
Day 1:
  [ ] Заменить SHA-256 → bcrypt
  [ ] Добавить .env generator при первом запуске
  [ ] Добавить rate limiting (slowapi)
  [ ] Добавить input validation (pydantic)

Day 2:
  [ ] Добавить retry logic для VK/TRASSIR
  [ ] Добавить health check endpoint
  [ ] Добавить backup restore UI
  [ ] Протестировать installer на чистой VM
```

### Sprint 1: Stability (3 дня)

```
Day 3:
  [ ] Вынести integrations в отдельный модуль
  [ ] Добавить circuit breaker pattern
  [ ] Добавить disk space monitoring
  [ ] Оптимизировать AI worker (lazy load)

Day 4:
  [ ] Добавить pagination на списки
  [ ] Добавить search/filter на Cars page
  [ ] Добавить audit log для настроек
  [ ] Улучшить error handling в frontend

Day 5:
  [ ] Написать e2e тесты (pytest + playwright)
  [ ] Протестировать offline режим
  [ ] Протестировать crash recovery
  [ ] Обновить документацию
```

### Sprint 2: Polish (2 дня)

```
Day 6:
  [ ] Добавить keyboard shortcuts
  [ ] Добавить print receipt
  [ ] Добавить CSV export
  [ ] Улучшить onboarding

Day 7:
  [ ] Финальное тестирование
  [ ] Сборка релизной версии
  [ ] Подготовка release notes
  [ ] Deployment guide
```

---

## L. ЧЁТКИЙ СПИСОК СЛЕДУЮЩИХ ШАГОВ

### Немедленно (сегодня):

```bash
# 1. Установить bcrypt
pip install bcrypt==4.1.3

# 2. Создать .env файл
echo "WASHCONTROL_SECRET=$(python -c 'import secrets; print(secrets.token_hex(32))')" > .env

# 3. Добавить slowapi
pip install slowapi==0.1.9
```

### В течение 24 часов:

1. ✏️ Исправить `database.py` — заменить `hash_password()` на bcrypt
2. ✏️ Исправить `auth.py` — добавить pydantic валидацию всех endpoints
3. ✏️ Добавить `core/security.py` — rate limiting + JWT rotation
4. ✏️ Добавить `integrations/base.py` — retry decorator
5. ✏️ Исправить `vk_notify.py` — добавить retry logic
6. ✏️ Исправить `cameras.py` — добавить circuit breaker
7. ✏️ Добавить `backup_restore` endpoint в `reports.py`
8. ✏️ Добавить UI компонент BackupRestore в frontend

### В течение 48 часов:

1. 🧪 Протестировать на Windows 10/11 VM (чистая установка)
2. 🧪 Протестировать offline режим (отключить сеть)
3. 🧪 Протестировать crash recovery (kill process mid-shift)
4. 🧪 Протестировать backup/restore цикл
5. 📝 Обновить README.md с новыми требованиями
6. 📝 Добавить CHANGELOG.md
7. 📝 Добавить SECURITY.md

### В течение 1 недели:

1. 🚀 Release v1.0.1 с critical fixes
2. 🚀 Setup CI/CD (GitHub Actions для сборки)
3. 🚀 Monitoring setup (health checks + alerts)
4. 🚀 User documentation (pdf guide для админа)

---

## ЗАКЛЮЧЕНИЕ

**Проект технически грамотный**, архитектура продумана, код чистый.  
**Основные проблемы:** безопасность паролей, отсутствие retry logic, не протестированный installer.

**Риски минимальны** при условии выполнения Sprint 0 (critical fixes).  
**Срок до production-ready:** 5-7 рабочих дней.

**Рекомендация:** Не добавлять новые фичи до завершения Sprint 1.  
**Приоритет:** Стабильность > Функциональность.

---

*Audit completed by Senior Software Architect*  
*Next review: after Sprint 1 completion*
