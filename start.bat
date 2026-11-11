@echo off
setlocal enabledelayedexpansion
title OutboundOS - Local SQLite Cold Outreach Engine

cls
echo ===============================================================================
echo                OutboundOS - Local Windows 10/11 Architecture
echo             Strict Zero-Cost Implementation: $0.00 Operating Budget
echo ===============================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected on your system.
    echo.
    echo Please install Node.js 20 or higher from:
    echo   https://nodejs.org/
    echo.
    echo After installing, restart this script.
    echo.
    pause
    exit /b 1
)

:: 2. Display Node version
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [OK] Detected Node.js !NODE_VERSION!

:: 3. Check for .env file; create from .env.example if missing
if not exist ".env" (
    echo [SETUP] No .env file detected. Creating .env from .env.example...
    copy ".env.example" ".env" >nul
    echo [OK] Created .env configuration file with zero required secrets.
) else (
    echo [OK] Existing .env file found.
)

:: 4. Ensure local application data directory exists
if not exist "data" (
    mkdir "data"
    echo [OK] Initialized local data directory.
)

:: 5. Check if node_modules exists; if not, run npm install
if not exist "node_modules\" (
    echo.
    echo [SETUP] Installing application dependencies (this only runs on first launch)...
    echo        Please wait 1-2 minutes...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] npm install encountered an error.
        echo Please ensure you have internet access and try running 'npm install' manually.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
) else (
    echo [OK] Dependencies verified.
)

echo.
echo ===============================================================================
echo  OutboundOS Local Services Starting:
echo  - SQLite Engine: %LOCALAPPDATA%\OutboundOS\data\outboundos.sqlite (WAL Mode)
echo  - Background Sending Queue: ACTIVE (executes when OutboundOS is running)
echo  - Local Auth & Master Password: ACTIVE
echo  - Zero-Cost Operation: $0.00 Monthly Cost
echo ===============================================================================
echo.
echo Opening OutboundOS in your default browser at http://localhost:3000 ...
echo Press Ctrl+C at any time to shut down the server, or run stop.bat.
echo.

:: 6. Launch default browser after 3 second delay in background
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: 7. Start OutboundOS server
call npm run dev

pause
