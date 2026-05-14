@echo off
chcp 65001 >nul
echo ============================================================
echo   WASHCONTROL - Автономная сборка (без установки Python)
echo ============================================================
echo.
echo Этот скрипт создаст полностью автономное приложение:
echo - Встроенный Python (не нужно устанавливать отдельно)
echo - Один exe-файл или портативная папка
echo - Готово к запуску на любой Windows
echo.
echo НАЧИНАЮ СБОРКУ...
echo.

REM Проверка наличия Python для сборки
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Python не найден!
    echo.
    echo Для сборки НУЖЕН Python только на этапе компиляции.
    echo Установите Python с https://www.python.org/downloads/
    echo ИЛИ используйте альтернативный метод ниже.
    echo.
    goto ALTERNATIVE
)

echo [OK] Python найден
echo.

REM Установка зависимостей
echo [ШАГ 1/4] Установка зависимостей...
pip install -r requirements.txt --quiet
pip install pyinstaller --quiet
echo [OK] Зависимости установлены
echo.

REM Создание spec файла для PyInstaller
echo [ШАГ 2/4] Создание конфигурации сборки...
(
echo ^# -*- mode: python ; coding: utf-8 -*-
echo.
echo block_cipher = None
echo.
echo a = Analysis(
echo     ['backend/main.py'],
echo     pathex=[],
echo     binaries=[],
echo     datas=[
echo         ('frontend', 'frontend'),
echo         ('data', 'data'),
echo         ('.env', '.env'),
echo     ],
echo     hiddenimports=[
echo         'uvicorn',
echo         'fastapi',
echo         'sqlalchemy',
echo         'bcrypt',
echo         'pydantic',
echo         'aiohttp',
echo         'PIL',
echo         'numpy',
echo     ],
echo     hookspath=[],
echo     hooksconfig={},
echo     runtime_hooks=[],
echo     excludes=[],
echo     win_no_prefer_redirects=False,
echo     win_private_assemblies=False,
echo     cipher=block_cipher,
echo     noarchive=False,
echo )
echo pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
echo.
echo exe = EXE(
echo     pyz,
echo     a.scripts,
echo     a.binaries,
echo     a.zipfiles,
echo     a.datas,
echo     [],
echo     name='WashControl',
echo     debug=False,
echo     bootloader_ignore_signals=False,
echo     strip=False,
echo     upx=True,
echo     upx_exclude=[],
echo     runtime_tmpdir=None,
echo     console=False,
echo     disable_windowed_traceback=False,
echo     argv_emulation=False,
echo     target_arch=None,
echo     codesign_identity=None,
echo     entitlements_file=None,
echo     icon=None,
echo )
) > washcontrol.spec
echo [OK] Конфигурация создана
echo.

REM Сборка через PyInstaller
echo [ШАГ 3/4] Компиляция в EXE (это займет 3-5 минут)...
pyinstaller --clean washcontrol.spec
echo.

if exist "dist\WashControl.exe" (
    echo [OK] Сборка успешна!
    echo.
    
    REM Создание портативной версии
    echo [ШАГ 4/4] Создание портативной версии...
    if not exist "build\portable" mkdir "build\portable"
    copy "dist\WashControl.exe" "build\portable\" >nul
    copy ".env" "build\portable\" >nul
    if not exist "build\portable\data" mkdir "build\portable\data"
    if not exist "build\portable\logs" mkdir "build\portable\logs"
    
    REM Создание ярлыка запуска
    (
    echo @echo off
    echo chcp 65001 ^>nul
    echo echo Запуск WashControl...
    echo start http://localhost:8000
    echo WashControl.exe
    echo pause
    ) > "build\portable\ЗАПУСТИТЬ.bat"
    
    echo.
    echo ============================================================
    echo   СБОРКА ЗАВЕРШЕНА УСПЕШНО!
    echo ============================================================
    echo.
    echo Портативная версия готова в папке: build\portable\
    echo.
    echo Что внутри:
    echo   - WashControl.exe (автономный, со встроенным Python)
    echo   - ЗАПУСТИТЬ.bat (ярлык для запуска)
    echo   - data\ (база данных и настройки)
    echo.
    echo КАК ИСПОЛЬЗОВАТЬ:
    echo 1. Скопируйте всю папку 'portable' куда угодно
    echo 2. Запустите 'ЗАПУСТИТЬ.bat' или 'WashControl.exe'
    echo 3. Откройте браузер: http://localhost:8000
    echo.
    echo Python устанавливать НЕ НУЖНО!
    echo.
    echo Первый вход:
    echo   Логин: admin
    echo   Пароль: admin123
    echo.
    echo ============================================================
    pause
) else (
    echo [ОШИБКА] Не удалось создать EXE файл
    echo Проверьте логи выше
    pause
    exit /b 1
)

goto END

:ALTERNATIVE
echo ============================================================
echo   АЛЬТЕРНАТИВНЫЙ ВАРИАНТ (если нет Python для сборки)
echo ============================================================
echo.
echo Если вы не можете установить Python для сборки, есть варианты:
echo.
echo 1. Попросите кого-то с Python собрать для вас
echo 2. Используйте готовый дистрибутив (если предоставлен)
echo 3. Установите Python временно только для сборки:
echo    - Скачайте с https://www.python.org/downloads/
echo    - Установите (займет 2 минуты)
echo    - Запустите этот скрипт еще раз
echo    - После сборки Python можно удалить
echo.
echo ============================================================
pause

:END
