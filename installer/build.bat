@echo off
chcp 65001 > nul
title WashControl — Сборка

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   WashControl — Сборка Windows .exe  ║
echo  ╚══════════════════════════════════════╝
echo.

:: Переходим в корень проекта (папка выше installer\)
cd /d "%~dp0.."

:: Проверяем Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Python не найден!
    echo Скачайте Python 3.11 с https://python.org
    pause
    exit /b 1
)

:: Проверяем Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден!
    echo Скачайте Node.js с https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Python и Node.js найдены
echo.
echo Запускаем сборку...
echo.

python installer\build_windows.py

if errorlevel 1 (
    echo.
    echo [ОШИБКА] Сборка завершилась с ошибкой
    pause
    exit /b 1
)

echo.
echo [ГОТОВО] Проверьте папку dist\
pause
