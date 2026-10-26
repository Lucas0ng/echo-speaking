@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
set "HF_HUB_DISABLE_SYMLINKS_WARNING=1"

powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction Stop; if ($c) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://127.0.0.1:8765"
  exit /b 0
)

if not exist ".venv\Scripts\python.exe" (
  echo 第一次运行，正在准备 Python 环境……
  call :ensure_uv
  if errorlevel 1 exit /b 1
  "%UV%" venv --python 3.12 .venv
  if errorlevel 1 (
    echo Python 环境创建失败，检查网络后重试。
    pause
    exit /b 1
  )
  "%UV%" pip install --python .venv\Scripts\python.exe -r requirements.txt
  if errorlevel 1 (
    echo 官方源下载失败，改用清华镜像重试……
    "%UV%" pip install --python .venv\Scripts\python.exe -r requirements.txt --index-url https://pypi.tuna.tsinghua.edu.cn/simple
    if errorlevel 1 (
      rmdir /s /q .venv
      echo 依赖安装失败，检查网络后重新双击。
      pause
      exit /b 1
    )
  )
)

echo 「回声」正在启动，浏览器会自动打开。用完关掉这个窗口即可。
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8765'"
".venv\Scripts\python.exe" app.py
if errorlevel 1 pause
exit /b %errorlevel%

:ensure_uv
set "UV=%USERPROFILE%\.local\bin\uv.exe"
if exist "%UV%" exit /b 0
where uv >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%i in ('where uv') do (
    set "UV=%%i"
    exit /b 0
  )
)
echo 正在安装 uv……
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"
if not exist "%USERPROFILE%\.local\bin\uv.exe" (
  echo uv 安装失败，检查网络后重试。
  pause
  exit /b 1
)
set "UV=%USERPROFILE%\.local\bin\uv.exe"
exit /b 0
