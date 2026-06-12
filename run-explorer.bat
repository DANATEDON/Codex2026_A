@echo off
setlocal
cd /d "%~dp0"
echo Starting Remote Sensing Band Explorer without Docker...
echo.
node scripts\serve-explorer.mjs
echo.
pause
