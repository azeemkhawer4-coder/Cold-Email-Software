@echo off
setlocal enabledelayedexpansion
title OutboundOS - Stop Server

echo ===============================================================================
echo                     Stopping OutboundOS Local Server
echo ===============================================================================
echo.

set PORT=3000
set FOUND=0

echo Checking for running process on port %PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do (
    set TARGET_PID=%%a
    if defined TARGET_PID (
        echo Terminating process PID !TARGET_PID! on port %PORT%...
        taskkill /f /pid !TARGET_PID! >nul 2>&1
        set FOUND=1
    )
)

if "!FOUND!"=="1" (
    echo.
    echo [OK] OutboundOS server has been stopped.
) else (
    echo.
    echo [INFO] No active process was found listening on port %PORT%.
)

echo.
pause
