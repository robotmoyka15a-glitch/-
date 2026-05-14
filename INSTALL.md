# 🚀 WashControl — Установка и запуск

## Быстрый старт

### Для пользователей (Windows)

1. **Скачайте инсталлятор** `WashControl Setup 1.0.0.exe`
2. **Запустите** и нажмите "Установить"
3. **Войдите** в приложение:
   - Логин: `admin`
   - Пароль: `admin123`
4. **Смените пароль** в разделе Настройки → Пользователи

### Для разработчиков

```bash
# Клонирование
git clone <repository-url>
cd washcontrol

# Backend
pip install -r requirements.txt
python -m backend.main

# Frontend (в отдельном терминале)
cd frontend
npm install
npm run dev
```

---

## Структура проекта

```
washcontrol/
├── 📁 backend/              # Python FastAPI сервер
│   ├── main.py              # Точка входа
│   ├── database.py          # SQLite модели
│   ├── config.py            # Конфигурация
│   ├── routers/             # API endpoints
│   └── services/            # Telegram, VK, AI, scheduler
├── 📁 frontend/             # Electron + React
│   ├── src/
│   │   ├── pages/           # Страницы приложения
│   │   ├── components/      # Компоненты
│   │   ├── api.js           # API клиент
│   │   └── store.js         # Zustand store
│   ├── electron/            # Electron main/preload
│   └── package.json
├── 📁 data/                 # Данные приложения
│   ├── washcontrol.db       # SQLite база
│   ├── backups/             # Бэкапы
│   ├── logs/                # Логи
│   ├── models/              # AI модели
│   └── screenshots/         # Скриншоты камер
├── 📁 installer/            # Скрипты сборки
├── 📁 website/              # Лендинг сайт
├── 📁 docs/                 # Документация
├── requirements.txt         # Python зависимости
├── start_dev.bat            # Запуск разработки
├── start_server.bat         # Запуск сервера
└── README.md                # Эта инструкция
```

---

## Требования

### Минимальные

| Компонент | Требование |
|-----------|------------|
| ОС | Windows 10 x64 |
| CPU | 2 ядра |
| RAM | 2 ГБ (без AI) |
| Диск | 500 МБ |
| Python | 3.11+ (для разработки) |
| Node.js | 18+ (для разработки) |

### С AI модулем

| Компонент | Требование |
|-----------|------------|
| RAM | 4+ ГБ |
| Диск | +3 ГБ для модели |

---

## Установка зависимостей

### Python

```bash
pip install -r requirements.txt
```

**Что устанавливается:**
- `fastapi` — веб фреймворк
- `uvicorn` — ASGI сервер
- `python-multipart` — форма данные
- `PyJWT` — JWT токены
- `httpx` — HTTP клиент
- `openpyxl` — Excel экспорт
- `python-telegram-bot` — Telegram бот
- `vk-api` — VK интеграция
- `APScheduler` — планировщик задач

### Опционально: AI

```bash
pip install llama-cpp-python \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
```

### Node.js

```bash
cd frontend
npm install
```

**Что устанавливается:**
- `react` — UI библиотека
- `react-router-dom` — роутинг
- `axios` — HTTP клиент
- `recharts` — графики
- `zustand` — state management
- `electron` — desktop обёртка
- `vite` — сборщик
- `electron-builder` — упаковщик

---

## Запуск

### Вариант 1: Разработка (Dev mode)

```bash
# Windows: дважды кликните
start_dev.bat

# Или вручную:
# Terminal 1
python -m backend.main

# Terminal 2
cd frontend && npm run dev
```

**Порты:**
- Backend API: `http://127.0.0.1:8765`
- Frontend Vite: `http://localhost:5173`
- Swagger docs: `http://127.0.0.1:8765/docs`

### Вариант 2: Только сервер

```bash
# Windows
start_server.bat

# Или
python -m backend.main
```

### Вариант 3: Production (Electron)

```bash
# Сборка
python installer/build_windows.py

# Результат: dist/WashControl Setup 1.0.0.exe
```

---

## Первая настройка

### 1. Вход в систему

1. Откройте приложение
2. Введите:
   - Логин: `admin`
   - Пароль: `admin123`

### 2. Смена пароля

⚠️ **Обязательно!** Сразу после первого входа:

1. Настройки → Пользователи
2. Найдите `admin`
3. Нажмите "Сбросить пароль"
4. Введите новый пароль

### 3. Telegram бот

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot`
3. Придумайте имя и username
4. Скопируйте токен (вида `123456789:ABCdef...`)
5. Узнайте Chat ID через [@userinfobot](https://t.me/userinfobot)
6. В приложении: Настройки → Telegram
   - Вставьте токен
   - Вставьте Chat ID

### 4. VK уведомления

1. Откройте вашу группу VK
2. Управление → API → Создать ключ
3. Права: `messages`, `wall`
4. Скопируйте токен
5. В приложении: Настройки → VK
   - Вставьте токен
   - Вставьте ID владельца
   - Вставьте ID группы

### 5. TRASSIR камеры

1. Настройки → TRASSIR
2. Введите:
   - IP сервера (например `192.168.1.100`)
   - Порт (обычно `8080`)
   - Логин/пароль от TRASSIR
3. Нажмите "Загрузить каналы"
4. Проверьте список каналов

### 6. AI помощник (опционально)

**Вариант A: Builtin (локальная модель)**

1. Скачайте модель:
   - [Qwen2.5-3B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF)
   - Файл: `qwen2.5-3b-instruct-q4_k_m.gguf` (~2.3 ГБ)
2. Поместите в `data/models/`
3. Настройки → AI → включите AI

**Вариант B: Ollama**

```bash
ollama pull qwen2.5:3b
```

В приложении: AI Provider = `ollama`

**Вариант C: CLO API**

В приложении: AI Provider = `clo`, вставьте API ключ

---

## Повседневное использование

### Оператор (ежедневно)

```
08:00  Пришёл → Главная → "Открыть смену"
       → Уведомление уйдёт в Telegram

08:15  Машина → Журнал → "Добавить машину"
       → Выбрал режим (Экспресс/Стандарт/...)
       → Оплата (наличные/карта/QR)
       → Стёкла (протёрли/нет)
       → Сохранил

...    Повторяет для каждой машины

23:00  Главная → "Закрыть смену"
       → Отчёт уйдёт в Telegram и VK
```

### Администратор

- Просмотр статистики дня
- Проверка журнала событий
- Export отчётов в Excel
- Управление пользователями
- Настройка интеграций

---

## API Reference (кратко)

### Auth
```
POST /auth/login         # Логин
GET  /auth/me            # Текущий пользователь
```

### Shifts
```
POST /shifts/start       # Открыть смену
POST /shifts/end         # Закрыть смену
GET  /shifts/active      # Активная смена
```

### Cars
```
POST /cars               # Добавить машину
GET  /cars/today         # Машины сегодня
GET  /cars/stats/today   # Статистика дня
```

### Reports
```
GET  /reports/day        # Отчёт за день
GET  /reports/day/excel  # Excel за день
GET  /reports/week       # Отчёт за неделю
```

### Settings
```
GET  /settings           # Все настройки
PUT  /settings           # Обновить настройки
POST /settings/backup    # Создать бэкап
```

**Полная документация:** `http://127.0.0.1:8765/docs`

---

## Backup и восстановление

### Автоматические бэкапы

- Время: ежедневно в 03:00
- Папка: `data/backups/`
- Хранение: 14 дней

### Ручной бэкап

Настройки → Бэкап → "Создать бэкап сейчас"

### Восстановление

1. Остановите приложение
2. Скопируйте файл из `data/backups/` в `data/washcontrol.db`
3. Запустите приложение

---

## Troubleshooting

### Backend не запускается

```bash
# Проверьте порт
netstat -ano | findstr :8765

# Проверьте логи
cat data/logs/washcontrol.log
```

### Ошибка установки Python зависимостей

```bash
# Обновите pip
python -m pip install --upgrade pip

# Попробуйте с --user
pip install -r requirements.txt --user
```

### Ошибка установки Node.js зависимостей

```bash
# Очистите кэш
npm cache clean --force

# Удалите node_modules и переустановите
rm -rf frontend/node_modules
cd frontend && npm install
```

### AI не работает

- Проверьте наличие модели в `data/models/`
- Проверьте свободную RAM (нужно 4+ ГБ)
- Попробуйте Ollama вместо builtin

---

## Поддержка

- 📧 Email: support@example.com
- 💬 Telegram: @washcontrol_support
- 📖 Документация: `/docs/README.md`
- 🌐 Сайт: `/website/index.html`

---

*WashControl v1.0.0 — сделано для реальной автомойки*
