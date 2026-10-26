@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
if not exist ".venv\Scripts\python.exe" (
  echo 请先双击 start.bat 装好环境，再来下载课程。
  pause
  exit /b 1
)
".venv\Scripts\python.exe" tools\download_lessons.py %*
if not exist "data\dict\ecdict.sqlite" (
  if not exist "data\dict" mkdir "data\dict"
  echo 正在下载离线词典 ECDICT……
  powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv' -OutFile 'data\dict\ecdict.csv.part' -UseBasicParsing; exit 0 } catch { exit 1 }"
  if errorlevel 1 (
    del /q "data\dict\ecdict.csv.part" 2>nul
    echo 词典下载失败。GitHub 在国内有时连不上，不影响练习，下次双击会再试。
  ) else (
    move /y "data\dict\ecdict.csv.part" "data\dict\ecdict.csv" >nul
    ".venv\Scripts\python.exe" tools\build_dict.py
  )
)
echo 下载结束。退出回声再重新打开就能看到课程。
pause
exit /b 0
