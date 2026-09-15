# Quantum Foundation Local Dev Startup Script
Write-Host "Starting Quantum Foundation Development Servers..." -ForegroundColor Cyan

$root = $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; ..\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm.cmd run dev"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Quantum Foundation is running:" -ForegroundColor Green
Write-Host "  - Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  - Backend API: http://localhost:8000" -ForegroundColor Yellow
Write-Host "  - API Health: http://localhost:5173/api/health" -ForegroundColor Yellow
Write-Host "  - Admin Email: quantum.method.course@gmail.com" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
