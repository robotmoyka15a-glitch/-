@echo off
setlocal enabledelayedexpansion

:: WashControl Portable Builder
:: Creates standalone .exe version

echo ================================================================
echo         WASHCONTROL - Portable Builder
echo ================================================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is required to build portable version
    echo Please run INSTALL_AND_RUN.bat first
    pause
    exit /b 1
)

:: Install PyInstaller
echo [INFO] Installing PyInstaller...
pip install pyinstaller --quiet

:: Create build directory
set BUILD_DIR=build\washcontrol_portable
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"

:: Build executable
echo [BUILD] Creating executable...
pyinstaller --onefile ^
    --name washcontrol ^
    --hidden-import=backend.main ^
    --add-data "frontend;frontend" ^
    --add-data "data;data" ^
    --icon=frontend\logo.ico ^
    backend\main.py

if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

:: Copy files
echo [COPY] Preparing portable package...
copy dist\washcontrol.exe "%BUILD_DIR%\"
mkdir "%BUILD_DIR%\data"
xcopy /E /I frontend "%BUILD_DIR%\frontend"

:: Create launcher
(
echo @echo off
echo start "" "%~dp0washcontrol.exe"
) > "%BUILD_DIR%\RUN.bat"

echo.
echo ================================================================
echo         BUILD COMPLETE!
echo ================================================================
echo.
echo Portable version created in: %BUILD_DIR%
echo.
echo To use:
echo   1. Copy the entire '%BUILD_DIR%' folder anywhere
echo   2. Run 'RUN.bat' or 'washcontrol.exe'
echo   3. Open http://localhost:8000
echo.

pause
