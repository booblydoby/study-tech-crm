@echo off
echo ====================================
echo  Study CRM - Auto-restart Server
echo ====================================
echo Server will auto-restart if it crashes.
echo Press Ctrl+C twice to stop.
echo.

:loop
echo [%time%] Starting...
call pnpm dev
echo [%time%] Server stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop