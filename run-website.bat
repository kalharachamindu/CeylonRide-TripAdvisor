@echo off
title Discover Ceylon Server
echo ========================================
echo Starting Discover Ceylon Website...
echo ========================================
echo.
echo [1] Starting Node.js server...
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not start the server. 
    echo Make sure Node.js is installed.
    pause
)
pause
