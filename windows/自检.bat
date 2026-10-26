@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
if not exist ".venv\Scripts\python.exe" (
  echo 请先双击 start.bat 装好环境。
  pause
  exit /b 1
)
".venv\Scripts\python.exe" tools\selfcheck.py
echo.
echo 结果写在 selfcheck.log
pause
exit /b %errorlevel%
