"""把以前生成的字幕升级到当前版本（新生成的字幕已经是这样）：

- v1 → v2：老师读一遍、停几秒让你跟读、再读一遍被合成一句的地方，在停顿处切开。
- v2 → v3：紧挨着、单词完全相同的重复句只留第一句。

跟读分数按句子序号存，升级后序号会变：没切的句子分数跟着挪到新序号；被切开的句子原来的分数
是对着合并句打的，丢掉；去掉的重复句，分数并到留下的那句里。

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
        v = data.get("v", 1)
        if v >= app.TRANSCRIPT_V:
            continue
        rel, old = data["file"], data["sentences"]
        where = {i: i for i in range(len(old))}  # old index -> new index; lines that were cut apart are left out
        sents = old
        if v < 2:
            try:
                audio = app.decode_audio(app.safe_media(rel))
            except Exception as e:
                print(f"跳过（音频读不到：{getattr(e, 'detail', e)}）：{rel}")
                continue
            sents, where = [], {}
            for i, st in enumerate(old):
                parts = app.split_at_pauses(st, audio, app.whisper_text)
                if parts == [st]:
                    where[i] = len(sents)
                sents.extend(parts)
        n_cut = len(old) - len(where)
        sents, at = app.drop_repeats(sents)
        where = {i: at[j] for i, j in where.items()}
        data.update(sentences=sents, v=app.TRANSCRIPT_V)
        tmp = tp.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
        tmp.replace(tp)
        if len(sents) != len(old) or n_cut:
            if rel in shadow:
                moved: dict[str, list] = {}
                for k, hist in shadow[rel].items():
                    if int(k) in where:
                        moved.setdefault(str(where[int(k)]), []).extend(hist)
                shadow[rel] = {k: sorted(h, key=lambda x: x.get("t", 0)) for k, h in moved.items()}
                changed_state = True
            print(f"切开 {n_cut} 句，{len(old)} 句 → 现在 {len(sents)} 句：{rel}")
        else:
            print(f"不用改：{rel}")
    if changed_state:
        app.BACKUPS.mkdir(exist_ok=True)
        shutil.copy2(app.STATE_PATH, app.BACKUPS / f"progress-before-resplit-{int(time.time())}.json")
        app.STATE_PATH.write_text(json.dumps(state, ensure_ascii=False), "utf-8")
        print("跟读分数已按新序号挪好，原进度备份在 data/backups/。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
