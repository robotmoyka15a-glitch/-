@echo off
setlocal enabledelayedexpansion

:: WashControl Auto Installer and Launcher
:: Works on clean Windows without Python

echo ================================================================
echo         WASHCONTROL - Auto Install and Launch
echo ================================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python is already installed
    goto INSTALL_DEPS
)

echo [INFO] Python not found. Installing...
echo.

:: Create temp directory
set "TEMP_DIR=%TEMP%\washcontrol_python"
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

:: Download Python installer
echo [DOWNLOAD] Getting Python 3.11...
curl -sSL "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -o "%TEMP_DIR%\python-installer.exe"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to download Python.
    echo Please install Python manually from https://python.org
    pause
    exit /b 1
)

:: Install Python silently
echo [INSTALL] Installing Python...
"%TEMP_DIR%\python-installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
if %errorlevel% neq 0 (
    echo [ERROR] Installation failed.
    pause
    exit /b 1
)

:: Wait for PATH update
timeout /t 5 /nobreak >nul

:: Verify installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Python installed but not in PATH yet.
    echo Please restart your computer and run this script again.
    pause
    exit /b 1
)

echo [OK] Python installed successfully!
echo.

:INSTALL_DEPS
echo [INFO] Installing dependencies...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo [OK] Dependencies installed!
echo.

:: Initialize database
echo [SETUP] Initializing database...
python backend/main.py --init-only >nul 2>&1

:: Start server
echo.
echo ================================================================
echo         WASHCONTROL SERVER STARTING...
echo ================================================================
echo.
echo Open browser: http://localhost:8000
echo Login: admin
echo Password: admin123
echo.
echo Press Ctrl+C to stop server
echo.

start "" http://localhost:8000
python backend/main.py

pause
