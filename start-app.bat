@echo off
title Myntra E-Commerce Platform Launcher
color 0b

echo ========================================================
echo   Starting Myntra E-Commerce Platform
echo   1. Backend REST API Server (Port 5000)
echo   2. Expo Universal App (Web + Expo Go QR Code)
echo ========================================================
echo.

echo [1/3] Launching Backend REST API Server...
start "Myntra Backend API (Port 5000)" cmd /k "cd /d D:\myntra\server && node src/server.js"

ping -n 2 127.0.0.1 >nul

echo [2/3] Launching Expo Universal App (Mobile + Web)...
start "Myntra Expo App (Metro Bundler)" cmd /k "cd /d D:\myntra\MyntraApp && npx expo start"

ping -n 3 127.0.0.1 >nul

echo [3/3] Opening Web App in Browser...
start http://localhost:8081

echo.
echo ========================================================
echo   Everything is running!
echo   - Web Browser: Opens automatically at http://localhost:8081
echo   - Expo Go (Mobile): Scan the QR code in the Expo window with your phone!
echo ========================================================
echo.
pause

