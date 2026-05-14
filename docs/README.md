# WashControl — Полная документация

## 📋 Содержание

1. [Обзор системы](#обзор-системы)
2. [Архитектура](#архитектура)
3. [Установка и запуск](#установка-и-запуск)
4. [Настройка](#настройка)
5. [API Reference](#api-reference)
6. [База данных](#база-данных)
7. [Telegram-бот](#telegram-бот)
8. [VK интеграция](#vk-интеграция)
9. [TRASSIR камеры](#trassir-камеры)
10. [AI-модуль](#ai-модуль)
11. [Сборка инсталлятора](#сборка-инсталлятора)
12. [Развёртывание](#развёртывание)
13. [Backup и восстановление](#backup-и-восстановление)
14. [Roadmap](#roadmap)

---

## Обзор системы

**WashControl** — локальная система управления автомойкой для Windows.

### Ключевые возможности

- ✅ Учёт сотрудников (открытие/закрытие смены, контроль опозданий)
- ✅ Журнал машин (режимы мойки, оплата, доп. услуги)
- ✅ Отчёты (день/неделя/месяц, экспорт в Excel)
- ✅ Telegram-бот (уведомления, команды, AI-ответы)
- ✅ VK уведомления (публикация в группу и ЛС)
- ✅ Интеграция с TRASSIR (скриншоты камер)
- ✅ Локальный AI-помощник (Qwen2.5-3B или Ollama/CLO API)
- ✅ Автоматические бэкапы базы данных

### Технологический стек

| Компонент | Технология |
|-----------|------------|
| Backend | Python 3.11+, FastAPI, SQLite |
| Frontend | React 18, Vite, Zustand |
| Desktop | Electron |
| AI | llama-cpp-python / Ollama / CLO API |
| Bot | python-telegram-bot |
| VK | vk-api |
| Scheduler | APScheduler |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        WashControl                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Electron  │  │   Vite      │  │   Python Backend        │ │
│  │   Main      │◄─┤   Dev       │  │   FastAPI               │ │
│  │   Process   │  │   Server    │  │   :8765                 │ │
│  └──────┬──────┘  └─────────────┘  └───────────┬─────────────┘ │
│         │                                       │               │
│         │           ┌───────────────────────────┼───────────┐   │
│         │           │                           │           │   │
│         ▼           ▼                           ▼           ▼   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SQLite Database                          ││
│  │  - users (пользователи)                                     ││
│  │  - shifts (смены)                                           ││
│  │  - cars (машины)                                            ││
│  │  - events (события)                                         ││
│  │  - settings (настройки)                                     ││
│  │  - ai_history (история AI)                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Telegram    │  │     VK       │  │    TRASSIR           │  │
│  │  Bot         │  │     API      │  │    Cameras           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  AI Worker   │  │  Scheduler   │  │    Backup Service    │  │
│  │  (llama/    │  │  (APS)       │  │    ( nightly )       │  │
│  │   ollama)    │  │              │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Установка и запуск

### Вариант 1: Готовый инсталлятор (Windows)

1. Скачайте `WashControl Setup 1.0.0.exe`
2. Запустите, нажмите **Установить**
3. После установки появится ярлык на рабочем столе
4. Войдите: `admin` / `admin123`

### Вариант 2: Из исходников (разработка)

**Требования:**
- Python 3.11+
- Node.js 18+

**Шаги:**

```bash
# 1. Клонируйте репозиторий
git clone <repository-url>
cd washcontrol

# 2. Установите Python зависимости
pip install -r requirements.txt

# 3. Установите Node.js зависимости
cd frontend
npm install

# 4. Запустите разработку
# Вариант A: start_dev.bat (Windows)
# Вариант B: вручную
# Terminal 1: python -m backend.main
# Terminal 2: cd frontend && npm run dev
```

### Вариант 3: Только сервер (без Electron)

```bash
# Запуск только backend API
python -m backend.main

# API доступен на http://127.0.0.1:8765
# Swagger docs: http://127.0.0.1:8765/docs
```

---

## Настройка

### Переменные окружения

| Переменная | Значение по умолчанию | Описание |
|------------|----------------------|----------|
| `WASHCONTROL_HOST` | `127.0.0.1` | Хост API сервера |
| `WASHCONTROL_PORT` | `8765` | Порт API сервера |
| `WASHCONTROL_SECRET` | `washcontrol-secret-change-me` | JWT секрет |
| `WASHCONTROL_LOG_LEVEL` | `INFO` | Уровень логирования |

### Первая настройка приложения

После первого входа под `admin`:

1. **Telegram**: Настройки → Telegram
   - Вставьте токен бота от @BotFather
   - Вставьте Chat ID от @userinfobot

2. **VK**: Настройки → VK
   - Токен сообщества (права: messages, wall)
   - ID владельца и ID группы

3. **TRASSIR**: Настройки → TRASSIR
   - IP сервера, порт, логин/пароль
   - Нажмите "Загрузить каналы"

4. **AI**: Настройки → AI
   - Выберите провайдер: builtin / ollama / clo
   - Для builtin: скачайте модель `.gguf`

---

## API Reference

### Base URL
```
http://127.0.0.1:8765
```

### Authentication

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/auth/login` | POST | Логин (username, password) → JWT token |
| `/auth/me` | GET | Текущий пользователь |
| `/auth/change-password` | POST | Смена пароля |

### Shifts

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/shifts/start` | POST | Открыть смену |
| `/shifts/end` | POST | Закрыть смену |
| `/shifts/active` | GET | Активная смена |
| `/shifts/today` | GET | Смены сегодня |
| `/shifts/history` | GET | История смен (params: date_from, date_to) |

### Cars

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/cars` | POST | Добавить машину |
| `/cars/today` | GET | Машины сегодня |
| `/cars/shift/{id}` | GET | Машины по смене |
| `/cars/stats/today` | GET | Статистика дня |
| `/cars/{id}` | PUT | Обновить машину |
| `/cars/{id}` | DELETE | Удалить машину |

### Reports

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/reports/day` | GET | Отчёт за день |
| `/reports/day/excel` | GET | Excel за день |
| `/reports/week` | GET | Отчёт за неделю |
| `/reports/month` | GET | Отчёт за месяц |
| `/reports/range` | GET | Отчёт за период |
| `/reports/range/excel` | GET | Excel за период |

### Settings

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/settings` | GET | Все настройки |
| `/settings` | PUT | Обновить настройки |
| `/settings/backup` | POST | Создать бэкап |
| `/settings/backups` | GET | Список бэкапов |

### AI

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/ai/status` | GET | Статус AI модуля |
| `/ai/ask` | POST | Задать вопрос AI |
| `/ai/summary` | GET | AI сводка дня |
| `/ai/history` | GET | История AI запросов |

---

## База данных

### Схема таблиц

#### users
```sql
id          INTEGER PRIMARY KEY
username    TEXT UNIQUE
full_name   TEXT
password    TEXT (SHA-256 hash)
role        TEXT ('operator' | 'admin')
is_active   INTEGER
created_at  TEXT
```

#### shifts
```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
date            TEXT (YYYY-MM-DD)
started_at      TEXT
ended_at        TEXT
is_late         INTEGER
late_minutes    INTEGER
note            TEXT
```

#### cars
```sql
id                  INTEGER PRIMARY KEY
shift_id            INTEGER REFERENCES shifts(id)
user_id             INTEGER REFERENCES users(id)
arrived_at          TEXT
wash_mode           INTEGER (1-4)
payment_method      TEXT ('cash' | 'card' | 'qr')
amount              REAL
extra_service       INTEGER
extra_service_name  TEXT
extra_payment       TEXT
extra_amount        REAL
windows_wiped       INTEGER
note                TEXT
```

#### events
```sql
id          INTEGER PRIMARY KEY
user_id     INTEGER
shift_id    INTEGER
event_type  TEXT
title       TEXT
body        TEXT
source      TEXT
screenshot  TEXT
created_at  TEXT
```

#### settings
```sql
key     TEXT PRIMARY KEY
value   TEXT
```

---

## Telegram-бот

### Команды

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие |
| `/status` | Кто на смене сейчас |
| `/today` | Итоги дня |
| `/cars N` | Последние N машин |
| `/report` | Полный отчёт за день |

### Реализация

Файл: `backend/services/telegram_bot.py`

Бот работает в фоне через `asyncio`, обрабатывает:
- Команды (/start, /status, /today, etc.)
- Текстовые вопросы (пересылает в AI модуль)
- Уведомления от системы (смена открыта/закрыта)

---

## VK интеграция

### Настройка

1. Создайте сообщество VK
2. Перейдите: Управление → API → Создать ключ
3. Права: `messages`, `wall`, `photos`
4. Скопируйте токен в настройки приложения

### Функции

- Публикация итогов смены на стену группы
- Отправка личных сообщений владельцу
- Уведомления о важных событиях

Файл: `backend/services/vk_notify.py`

---

## TRASSIR камеры

### Подключение

1. Настройки → TRASSIR
2. Введите:
   - IP сервера (например `192.168.1.100`)
   - Порт (обычно `8080`)
   - Логин/пароль от TRASSIR
3. Нажмите "Загрузить каналы"

### API endpoints

| Endpoint | Описание |
|----------|----------|
| `/cameras/status` | Статус подключения |
| `/cameras/channels` | Список каналов |
| `/cameras/screenshot/{guid}` | Сделать скриншот |
| `/cameras/screenshots` | Список сохранённых скриншотов |

Файл: `backend/routers/cameras.py`

---

## AI-модуль

### Провайдеры

#### 1. Builtin (локальная модель)

**Требования:**
- 4+ ГБ RAM
- Модель: `qwen2.5-3b-instruct-q4_k_m.gguf` (~2.3 ГБ)

**Установка:**
```bash
pip install llama-cpp-python \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
```

**Настройка:**
1. Скачайте модель с HuggingFace
2. Поместите в `data/models/`
3. В приложении: Настройки → AI → включите AI

#### 2. Ollama

**Требования:**
- Установленный Ollama сервер
- Модель: `qwen2.5:3b`

**Настройка:**
```bash
ollama pull qwen2.5:3b
```
В приложении: AI Provider = `ollama`, URL = `http://localhost:11434`

#### 3. CLO API (облачный)

**Требования:**
- API ключ от CLO.ru

**Настройка:**
В приложении: AI Provider = `clo`, вставьте API ключ

### Файлы

- `backend/services/ai_worker.py` — основной AI воркер
- `backend/routers/ai_router.py` — API endpoints

---

## Сборка инсталлятора

### Требования

- Windows 10/11 x64
- Python 3.11+
- Node.js 18+
- Права администратора (рекомендуется)

### Процесс сборки

```bash
# Способ 1:双击 build.bat
installer\build.bat

# Способ 2: Python скрипт
python installer\build_windows.py
```

### Что делает скрипт

1. Проверяет Python 3.10+ и Node.js 18+
2. Устанавливает `pip install -r requirements.txt`
3. Устанавливает `npm install` во frontend/
4. Запускает `vite build`
5. Запускает PyInstaller для backend
6. Запускает `electron-builder --win --x64`

### Результат

```
dist/
└── WashControl Setup 1.0.0.exe  (~150 МБ)
```

---

## Развёртывание

### Системные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| ОС | Windows 10 x64 | Windows 11 x64 |
| CPU | 2 ядра | 4+ ядра |
| RAM | 2 ГБ (без AI) | 8 ГБ (с AI) |
| Диск | 500 МБ | 2 ГБ + данные |
| Сеть | Локальная | Интернет для TG/VK |

### Production чеклист

- [ ] Смените пароль admin по умолчанию
- [ ] Настройте Telegram бота
- [ ] Настройте VK уведомления
- [ ] Включите автоматические бэкапы
- [ ] Проверьте права доступа к папке data/
- [ ] Настройте автозапуск приложения

### Автозапуск

Добавьте ярлык `WashControl.exe` в:
```
shell:startup
```

Или используйте Планировщик заданий Windows.

---

## Backup и восстановление

### Автоматические бэкапы

- Время: ежедневно в 03:00
- Папка: `data/backups/`
- Хранение: 14 дней
- Формат: `washcontrol_YYYYMMDD_HHMMSS.db`

### Ручной бэкап

Настройки → Бэкап → "Создать бэкап сейчас"

### Восстановление

1. Остановите приложение
2. Скопируйте файл бэкапа в `data/washcontrol.db`
3. Запустите приложение

### API endpoints

| Endpoint | Описание |
|----------|----------|
| `/settings/backup` | POST — создать бэкап |
| `/settings/backups` | GET — список бэкапов |

---

## Roadmap

### MVP (v1.0.0) ✅

- [x] Базовая функциональность (смены, машины, отчёты)
- [x] Telegram бот
- [x] VK уведомления
- [x] TRASSIR интеграция
- [x] AI модуль
- [x] Electron приложение
- [x] Windows инсталлятор

### v1.1.0

- [ ] Мобильная PWA версия
- [ ] Статистика по операторам
- [ ] Push-уведомления
- [ ] OCR номерных знаков

### v1.2.0

- [ ] Расчёт зарплаты операторов
- [ ] Интеграция с онлайн-кассой
- [ ] Мультиязычность
- [ ] Docker контейнер

### Future

- [ ] Облачная синхронизация
- [ ] Мульти-точечность (сеть моек)
- [ ] Клиентское мобильное приложение
- [ ] CRM для клиентов

---

## Поддержка

### Логи

- Backend: `data/logs/washcontrol.log`
- Electron: консоль DevTools (F12)

### Частые проблемы

**Backend не запускается:**
```bash
# Проверьте порты
netstat -ano | findstr :8765

# Перезапустите от администратора
```

**Telegram бот не работает:**
- Проверьте токен
- Проверьте Chat ID
- Проверьте интернет

**AI не отвечает:**
- Проверьте наличие модели
- Проверьте RAM (нужно 4+ ГБ)
- Попробуйте Ollama вместо builtin

---

*WashControl v1.0.0 — Документация полная*
