"""把旧字幕里"老师读一遍、停几秒让你跟读、再读一遍"被合成一句的地方切开（字幕 v1 → v2）。

新生成的字幕已经自动切好；这个脚本只处理以前生成的。跟读分数按句子序号存，
切开后序号会变：没切的句子分数跟着挪到新序号，被切开的句子原来的分数是对着合并句打的，丢掉。

用法（先退出回声，脚本会检查 8765 端口）：.venv/bin/python tools/resplit_transcripts.py
"""
from __future__ import annotations

import json
import shutil
import socket
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def server_running() -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", 8765)) == 0


def main() -> int:
    if server_running():
        print("回声还开着（8765 端口有服务）。先退出回声再运行，否则它会用旧的进度覆盖掉这里改好的。")
        return 1
    import app

    state = json.loads(app.STATE_PATH.read_text("utf-8")) if app.STATE_PATH.exists() else {}
    shadow = state.get("shadow") or {}
    changed_state = False
    for tp in sorted(app.TRANS.glob("*.json")):
        data = json.loads(tp.read_text("utf-8"))
        if data.get("v", 1) >= app.TRANSCRIPT_V:
            continue
        rel = data["file"]
        try:
            audio = app.decode_audio(app.safe_media(rel))
        except Exception as e:
            print(f"跳过（音频读不到：{getattr(e, 'detail', e)}）：{rel}")
            continue
        new, where = [], {}  # where: old index -> new index, only for lines that stayed whole
        for i, st in enumerate(data["sentences"]):
            parts = app.split_at_pauses(st, audio, app.whisper_text)
            if parts == [st]:
                where[i] = len(new)
            new.extend(parts)
        n_old = len(data["sentences"])
        n_split = n_old - len(where)
        data.update(sentences=new, v=app.TRANSCRIPT_V)
        tmp = tp.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
        tmp.replace(tp)
        if n_split and rel in shadow:
            shadow[rel] = {str(where[int(k)]): v for k, v in shadow[rel].items() if int(k) in where}
            changed_state = True
        print(f"{n_split} 句切开，{n_old} 句 → 现在 {len(new)} 句：{rel}" if n_split else f"不用切：{rel}")
    if changed_state:
        app.BACKUPS.mkdir(exist_ok=True)
        shutil.copy2(app.STATE_PATH, app.BACKUPS / f"progress-before-resplit-{int(time.time())}.json")
        app.STATE_PATH.write_text(json.dumps(state, ensure_ascii=False), "utf-8")
        print("跟读分数已按新序号挪好，原进度备份在 data/backups/。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
