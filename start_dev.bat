@echo off
chcp 65001 > nul
title WashControl — Режим разработки

echo.
echo  WashControl — Запуск в режиме разработки
echo  ==========================================
echo.

cd /d "%~dp0"

:: Проверяем зависимости Python
echo Проверяем Python зависимости...
python -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ОШИБКА] Не удалось установить Python зависимости
    pause
    exit /b 1
)

:: Запускаем backend в отдельном окне
echo Запускаем backend...
start "WashControl Backend" cmd /k "cd /d %~dp0 && python -m backend.main"

:: Ждём пока backend поднимется
timeout /t 3 /nobreak > nul

:: Устанавливаем Node.js зависимости если нужно
if not exist "frontend\node_modules" (
    echo Устанавливаем Node.js зависимости...
    cd frontend
    npm install --legacy-peer-deps
    cd ..
)

:: Запускаем Electron + Vite
echo Запускаем интерфейс...
cd frontend
set NODE_ENV=development
npm run dev
