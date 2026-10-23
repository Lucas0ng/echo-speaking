#!/bin/zsh
# 双击启动「回声」。第一次运行会先装好 Python 环境（几分钟，只需一次）。
cd "$(dirname "$0")"
if lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  open "http://127.0.0.1:8765"; exit 0
fi
if [[ "$(uname -m)" != arm64 ]]; then
  echo "「回声」目前只支持 Apple 芯片（M1 及以后）的 Mac：转写用的 MLX 只能在 Apple 芯片上运行。"
  read -r "?按回车关闭。"; exit 1
fi

if [[ ! -x .venv/bin/python ]]; then
  UV=$(command -v uv || echo "$HOME/.local/bin/uv")
  if [[ ! -x "$UV" ]]; then
    echo "第一次运行需要安装 uv（Python 环境管理工具，https://astral.sh/uv）。"
    read -r "?按回车开始安装，或直接关掉窗口取消。"
    curl -LsSf https://astral.sh/uv/install.sh | sh || { read -r "?uv 安装失败，检查网络后重试。按回车关闭。"; exit 1; }
    UV="$HOME/.local/bin/uv"
  fi
  echo "› 正在准备 Python 环境……"
  "$UV" venv --python 3.12 .venv || { read -r "?Python 环境创建失败，检查网络后重试。按回车关闭。"; exit 1; }
  # PyPI 在国内经常很慢：先试官方源，失败就换清华镜像
  if ! "$UV" pip install --python .venv/bin/python -r requirements.txt; then
    echo "› 官方源下载失败，改用清华镜像重试……"
    "$UV" pip install --python .venv/bin/python -r requirements.txt --index-url https://pypi.tuna.tsinghua.edu.cn/simple \
      || { rm -rf .venv; read -r "?依赖安装失败，检查网络后重新双击。按回车关闭。"; exit 1; }
  fi
fi

echo "「回声」正在启动，浏览器会自动打开。用完关掉这个窗口即可。"
(sleep 2; open "http://127.0.0.1:8765") &
exec .venv/bin/python app.py
