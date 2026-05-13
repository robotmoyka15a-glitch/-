@echo off
chcp 65001 > nul
title WashControl Server

cd /d "%~dp0"

:: Тихая установка зависимостей при первом запуске
if not exist "data\washcontrol.db" (
    echo Первый запуск — устанавливаем зависимости...
    python -m pip install -r requirements.txt --quiet
)

python -m backend.main

if errorlevel 1 (
    echo.
    echo Сервер остановился. Нажмите любую клавишу...
    pause > nul
)
