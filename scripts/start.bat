@echo off
echo ====================================
echo  Study CRM - Auto-restart Server
echo ====================================
echo Starting server (will auto-restart on crash)...
echo Press Ctrl+C twice to stop
echo.

:loop
echo [%time%] Starting pnpm dev...
call pnpm dev 2>&1
echo [%time%] Server stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop