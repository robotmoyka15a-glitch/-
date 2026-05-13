@echo off
chcp 65001 > nul
title WashControl — Сборка

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║        WashControl — Сборка Windows .exe             ║
echo  ║        Одна кнопка — готовый инсталлятор             ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ── Проверка прав администратора ────────────────────────────────────────────
net session >nul 2>&1
if errorlevel 1 (
    echo  [ПРЕДУПРЕЖДЕНИЕ] Скрипт запущен БЕЗ прав администратора.
    echo  Для установки глобальных зависимостей могут потребоваться права.
    echo  Рекомендуется: правой кнопкой → "Запустить от имени администратора"
    echo.
    choice /C YN /M "  Продолжить без прав администратора?"
    if errorlevel 2 (
        echo  Отменено. Запустите от имени администратора.
        pause
        exit /b 1
    )
    echo.
) else (
    echo  [OK] Запущено с правами администратора
    echo.
)

:: ── Переходим в корень проекта (папка выше installer\) ───────────────────────
cd /d "%~dp0.."
echo  [INFO] Рабочая папка: %CD%
echo.

:: ── Проверяем Python ─────────────────────────────────────────────────────────
echo  [1/3] Проверка Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ОШИБКА] Python не найден!
    echo  Скачайте Python 3.11 с https://python.org
    echo  При установке отметьте "Add Python to PATH"
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  [OK] %%v

:: ── Проверяем Node.js ────────────────────────────────────────────────────────
echo  [2/3] Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ОШИБКА] Node.js не найден!
    echo  Скачайте Node.js 18 LTS с https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo  [OK] Node.js %%v
for /f "tokens=*" %%v in ('npm --version 2^>^&1') do echo  [OK] npm %%v

echo.
echo  [3/3] Запускаем сборку...
echo  ────────────────────────────────────────────────────────
echo.

:: ── Засекаем время старта ────────────────────────────────────────────────────
set BUILD_START=%time%

:: ── Запускаем основной Python скрипт ────────────────────────────────────────
python installer\build_windows.py

set BUILD_EXIT=%errorlevel%
set BUILD_END=%time%

echo.
echo  ────────────────────────────────────────────────────────

if %BUILD_EXIT% neq 0 (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  ✘  СБОРКА ЗАВЕРШИЛАСЬ С ОШИБКОЙ (код: %BUILD_EXIT%)      ║
    echo  ║     Проверьте вывод выше для диагностики.            ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    echo  Частые причины:
    echo    • Нет прав для установки пакетов — запустите от администратора
    echo    • Нет интернета — проверьте подключение
    echo    • Конфликт зависимостей — удалите node_modules и повторите
    echo.
    pause
    exit /b %BUILD_EXIT%
)

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  ✔  СБОРКА УСПЕШНО ЗАВЕРШЕНА!                        ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Начало: %BUILD_START%
echo  Конец:  %BUILD_END%
echo.

:: ── Предложить открыть папку dist ────────────────────────────────────────────
if exist "dist\" (
    echo  Инсталлятор находится в папке: %CD%\dist\
    echo.
    choice /C YN /M "  Открыть папку dist в Проводнике?"
    if errorlevel 1 if not errorlevel 2 (
        explorer "%CD%\dist"
    )
) else (
    echo  Папка dist не найдена — проверьте вывод выше.
)

echo.
pause
