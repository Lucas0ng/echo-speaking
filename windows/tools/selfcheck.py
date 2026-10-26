"""Check this machine's speech-to-text setup.

Writes selfcheck.log in the project folder. The log has the GPU, the backend
that was actually used, and one short transcription. It does not record API keys.
"""
from __future__ import annotations

import os
import platform
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

LINES: list[str] = []


def log(text: str = "") -> None:
    print(text, flush=True)
    LINES.append(text)


def shrink(text: str) -> str:
    return text.replace(str(Path.home()), "~")


def main() -> int:
    log(time.strftime("time: %Y-%m-%d %H:%M:%S"))
    log("platform: " + platform.platform())
    log("python: " + sys.version.split()[0])
    try:
        rev = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True, timeout=10).strip()
    except Exception:
        rev = "unknown"
    log("git: " + rev)
    try:
        smi = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
            text=True, timeout=8, stderr=subprocess.DEVNULL,
        ).strip()
        log("nvidia-smi: " + smi)
    except Exception as e:
        log(f"nvidia-smi: {type(e).__name__}")

    log("importing app…")
    import numpy as np
    import app

    log("backend: " + app.stt_backend())
    if sys.platform == "win32":
        dlls = [p.name for p in app._nvidia_dll_dirs()]
        log("nvidia dll dirs: " + (", ".join(dlls) if dlls else "(none yet; packages may be missing)"))
    if app.stt_backend() == "faster":
        ok, why = app._cuda_usable()
        log(f"cuda_usable: {ok}" + (f" ({why})" if why else ""))
    log("transcribing 1 second of silence (first run downloads the model)…")
    t0 = time.time()
    try:
        res = app.stt(np.zeros(app.SR, dtype=np.float32))
    except Exception as e:
        log(f"transcribe_error: {type(e).__name__}: {e}")
        log("result: fail")
        _write()
        return 1
    w = app.WHISPER
    log(f"transcribe_s: {time.time() - t0:.1f}")
    log("device: " + str(w.get("device")))
    log("compute_type: " + str(w.get("compute_type")))
    log("model: " + str(w.get("model")))
    if w.get("note"):
        log("note: " + str(w.get("note")))
    if w.get("error"):
        log("error: " + str(w.get("error")))
    log("text: " + repr((res.get("text") or "")[:160]))
    speech_check(app, np)
    log("result: ok")
    _write()
    return 0


def speech_check(app, np) -> None:
    """Time 30 seconds of real speech from the lesson audio, with word timestamps like the lessons use."""
    files = [app.media_dir() / ls["f"] for ls in app.LESSONS]
    clip = audio = None
    for clip in files[:10]:  # skip half-downloaded files
        try:
            audio = app.decode_audio(clip)[: 30 * app.SR]
            break
        except Exception:
            continue
    if audio is None:
        log("speech: no readable lesson audio yet (run 下载课程.bat), skipped")
        return
    t0 = time.time()
    try:
        res = app.stt(audio, words=True, prompt=app.FILLER_PROMPT)
    except Exception as e:
        log(f"speech_error: {type(e).__name__}: {e}")
        return
    secs = time.time() - t0
    n = len(app.word_list(res))
    log(f"speech: {clip.name}, {len(audio) / app.SR:.0f}s audio, {n} words, {secs:.1f}s to transcribe")
    log("speech_text: " + repr((res.get("text") or "")[:160]))


def _write() -> None:
    text = "\n".join(shrink(line) for line in LINES) + "\n"
    (ROOT / "selfcheck.log").write_text(text, encoding="utf-8")
    log("wrote selfcheck.log")


if __name__ == "__main__":
    sys.exit(main())
