@echo off
setlocal enabledelayedexpansion
title OutboundOS - SQLite Database Backup

cls
echo ===============================================================================
echo                OutboundOS - Create Instant SQLite Database Backup
echo ===============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected. Please install Node.js 20 or higher.
    pause
    exit /b 1
)

echo [INFO] Creating timestamped ACID SQLite database backup...
echo.

call npx tsx scripts/db-cli.ts backup

if %errorlevel% equ 0 (
    echo.
    echo ===============================================================================
    echo [SUCCESS] Backup completed. Your database snapshot is safely saved in:
    echo           %%LOCALAPPDATA%%\OutboundOS\data\backups\
    echo ===============================================================================
) else (
    echo.
    echo [ERROR] Backup operation failed. Please check the error above.
)

echo.
pause
