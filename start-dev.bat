@echo off
echo Starting Quantum Foundation Development Servers...

REM Start Backend
start "Quantum Backend (FastAPI)" cmd /k "cd /d %~dp0backend && ..\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload"

REM Start Frontend
start "Quantum Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

echo.
echo ========================================================
echo   Quantum Foundation servers are starting:
echo   - Frontend: http://localhost:5173
echo   - Backend API: http://localhost:8000
echo   - Admin Login: quantum.method.course@gmail.com
echo ========================================================
echo.
