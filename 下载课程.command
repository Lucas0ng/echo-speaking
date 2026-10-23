#!/bin/zsh
# 双击下载课程音频和离线词典：音频从 IELTSCast 和 BBC Learning English 的官方播客源下载到你自己的电脑（约 1GB，可中途关掉，下次接着下）。
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  read -r "?请先双击 start.command 装好环境，再来下载课程。按回车关闭。"; exit 1
fi
.venv/bin/python tools/download_lessons.py "$@"

# 点词查词用的离线词典 ECDICT（MIT 许可，约 65MB）
if [[ ! -f data/dict/ecdict.sqlite ]]; then
  mkdir -p data/dict
  echo "› 下载离线词典 ECDICT……"
  if curl -fL --retry 2 -o data/dict/ecdict.csv.part https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv; then
    mv data/dict/ecdict.csv.part data/dict/ecdict.csv && .venv/bin/python tools/build_dict.py
  else
    rm -f data/dict/ecdict.csv.part
    echo "词典下载失败（GitHub 在国内有时连不上），不影响练习，下次双击会再试。"
  fi
fi
read -r "?下载结束。退出回声再重新打开就能看到课程。按回车关闭。"
