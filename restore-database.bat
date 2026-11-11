@echo off
setlocal enabledelayedexpansion
title OutboundOS - Restore SQLite Database

cls
echo ===============================================================================
echo                OutboundOS - Restore SQLite Database from Backup
echo ===============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected. Please install Node.js 20 or higher.
    pause
    exit /b 1
)

echo Listing available backups:
echo.
call npx tsx scripts/db-cli.ts list
echo.

set /p BACKUP_NAME="Enter the exact backup filename to restore (e.g., outboundos_backup_...sqlite): "

if "%BACKUP_NAME%"=="" (
    echo [INFO] No backup selected. Operation cancelled.
    pause
    exit /b 0
)

echo.
echo [WARNING] Restoring will safely replace the active SQLite database with this backup.
set /p CONFIRM="Are you sure you want to proceed? (Y/N): "

if /i not "%CONFIRM%"=="Y" (
    echo [INFO] Restore operation cancelled by user.
    pause
    exit /b 0
)

echo.
echo [INFO] Restoring database...
call npx tsx scripts/db-cli.ts restore %BACKUP_NAME%

if %errorlevel% equ 0 (
    echo.
    echo ===============================================================================
    echo [SUCCESS] Database restored successfully. Restart OutboundOS to apply changes.
    echo ===============================================================================
) else (
    echo.
    echo [ERROR] Restore operation failed.
)

echo.
pause
