@echo off
chcp 65001 > nul
title WashControl — Сервер

cd /d "%~dp0"

:: ── Проверяем Python ──────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ОШИБКА] Python не найден!
    echo  Скачайте Python 3.11+ с https://python.org
    echo  При установке поставьте галку "Add Python to PATH"
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  [OK] %%v

:: ── Первый запуск: устанавливаем зависимости ─────────────────────────────────
if not exist "data\washcontrol.db" (
    echo.
    echo  [ПЕРВЫЙ ЗАПУСК] Устанавливаем зависимости Python...
    echo  Это займёт 1-2 минуты. Подождите...
    echo.
    python -m pip install --upgrade pip --quiet
    python -m pip install -r requirements.txt --quiet
    if errorlevel 1 (
        echo.
        echo  [ОШИБКА] Не удалось установить зависимости!
        echo  Проверьте подключение к интернету и повторите.
        pause
        exit /b 1
    )
    echo  [OK] Зависимости установлены.
    echo.
)

:: ── Запуск сервера ────────────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   🚿 WashControl — Сервер запущен            ║
echo  ║   Адрес: http://127.0.0.1:8765               ║
echo  ║   Документация: http://127.0.0.1:8765/docs   ║
echo  ║   Для остановки нажмите Ctrl+C               ║
echo  ╚══════════════════════════════════════════════╝
echo.

python -m backend.main

:: ── Сервер остановился ───────────────────────────────────────────────────────
if errorlevel 1 (
    echo.
    echo  [!] Сервер остановился с ошибкой.
    echo  Проверьте лог: data\logs\washcontrol.log
    echo.
)
pause
