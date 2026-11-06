@echo off
cd /d "%~dp0"
echo Starting Backend and Frontend...
start "Alfaaz Backend" cmd /c "start-backend.bat"
start "Alfaaz Frontend" cmd /c "start-frontend.bat"
echo Both servers started in separate windows.
