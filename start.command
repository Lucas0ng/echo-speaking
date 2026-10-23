#!/bin/zsh
# 双击启动「回声」
cd "$(dirname "$0")"
if lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  open "http://127.0.0.1:8765"; exit 0
fi
echo "「回声」正在启动，浏览器会自动打开。用完关掉这个窗口即可。"
(sleep 2; open "http://127.0.0.1:8765") &
exec .venv/bin/python app.py
