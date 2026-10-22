"""每天开口 · 本地口语练习软件（后端）

运行：双击 start.command，或 `.venv/bin/python app.py`
浏览器打开 http://127.0.0.1:8765
"""
from __future__ import annotations

import base64
import csv
import io
import json
import queue
import re
import secrets
import threading
import time
import wave
from pathlib import Path

import httpx
import numpy as np
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
TRANS = DATA / "transcripts"
RECS = DATA / "recordings"
for d in (DATA, TRANS, RECS):
    d.mkdir(parents=True, exist_ok=True)
CFG_PATH = ROOT / "config.json"
STATE_PATH = DATA / "progress.json"

DEFAULT_CFG = {
    "media_dir": "~/Downloads/正版雅思听力资源",
    "whisper_model": "mlx-community/whisper-large-v3-turbo",
    "text_provider": "deepseek",
    "providers": {
        "deepseek": {"label": "DeepSeek", "base_url": "https://api.deepseek.com", "api_key": "", "model": "deepseek-chat"},
        "glm": {"label": "GLM（智谱）", "base_url": "https://open.bigmodel.cn/api/paas/v4", "api_key": "", "model": ""},
        "omni": {"label": "Qwen-Omni（百炼，听音频）", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "api_key": "", "model": "qwen3.8-omni-flash"},
    },
}


def load_cfg() -> dict:
    cfg = json.loads(json.dumps(DEFAULT_CFG))
    if CFG_PATH.exists():
        try:
            user = json.loads(CFG_PATH.read_text("utf-8"))
            for k, v in user.items():
                if k == "providers":
                    for pk, pv in v.items():
                        cfg["providers"].setdefault(pk, {}).update(pv)
                else:
                    cfg[k] = v
        except Exception:
            pass
    return cfg


def save_cfg(cfg: dict) -> None:
    CFG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), "utf-8")
    try:
        CFG_PATH.chmod(0o600)
    except Exception:
        pass


CFG = load_cfg()
if not CFG_PATH.exists():
    save_cfg(CFG)


def media_dir() -> Path:
    return Path(CFG["media_dir"]).expanduser()


# ---------------------------------------------------------------- lessons
IE_DIR = "IELTS Speaking Shadowing - IELTSCast"
BB_DIR = "BBC The English We Speak"


def _clean(t: str) -> str:
    t = t.replace("’", "'")
    t = re.sub(r"[^\x20-\x7E]", "", t)
    return re.sub(r"\s+", " ", t).strip(" |:-")


def _rows(p: Path) -> list[dict]:
    with open(p, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def build_lessons() -> list[dict]:
    md = media_dir()
    ie = _rows(md / IE_DIR / "manifest.csv")
    bb = _rows(md / BB_DIR / "manifest.csv")
    lessons = []
    for r in sorted(ie, key=lambda r: r["date"]):
        t = r["title"]
        m = re.search(r"Part\s*([123])", r["url"].replace("_", " ") + " " + t)
        topic = _clean(re.sub(r"^(Episode|Lesson)\s*\d+\s*\|\s*", "", t))
        topic = re.sub(r"^Part\s*[123]\s*:?\s*", "", topic)
        topic = re.sub(r"^Lesson \d+:\s*", "", topic)
        topic = re.sub(r"\s*\(.*?\)\s*$", "", topic)
        topic = re.sub(r"^(Describe|Talk about)\s+", "", topic, flags=re.I)
        topic = topic[:1].upper() + topic[1:]
        part = int(m.group(1)) if m else (2 if re.match(r"^(A|An|Someone|Something)\b", topic) else 1)
        lessons.append({"t": topic, "p": part, "w": "pauses" in r["url"], "f": f"{IE_DIR}/{r['filename']}"})
    skip = ("Beating Speaking Anxiety", "My Song, My Home", "BBC Learning English Pantomime", "IMPORTANT")
    phrases, seen = [], set()
    for r in sorted(bb, key=lambda r: r["date"], reverse=True):
        t = r["title"]
        if any(t.startswith(s) for s in skip) or t.strip().lower() == "the english we speak":
            continue
        if not (md / BB_DIR / r["filename"]).exists():
            continue
        p = _clean(re.sub(r"^The English We Speak:?\s*", "", t, flags=re.I).strip("'\" "))
        p = re.sub(r"- The English We Speak$", "", p).strip(" '-")
        if not p or p.lower() in seen:
            continue
        seen.add(p.lower())
        phrases.append({"x": p[:1].upper() + p[1:], "b": f"{BB_DIR}/{r['filename']}"})
    for i, l in enumerate(lessons):
        l["n"] = i + 1
        if i < len(phrases):
            l.update(phrases[i])
    return lessons


try:
    LESSONS = build_lessons()
    LESSON_ERR = ""
except Exception as e:  # media folder missing
    LESSONS, LESSON_ERR = [], f"读不到资料文件夹：{e}"


def safe_media(rel: str) -> Path:
    base = media_dir().resolve()
    p = (base / rel).resolve()
    if base not in p.parents and p != base:
        raise HTTPException(400, "路径不在资料文件夹里")
    if not p.is_file():
        raise HTTPException(404, "找不到这个音频文件")
    return p


# ---------------------------------------------------------------- audio decoding
SR = 16000


def decode_audio(src) -> np.ndarray:
    """Decode any audio (path or bytes) to mono float32 16 kHz using PyAV."""
    import av

    container = av.open(io.BytesIO(src) if isinstance(src, (bytes, bytearray)) else str(src))
    resampler = av.AudioResampler(format="s16", layout="mono", rate=SR)
    chunks = []
    for frame in container.decode(audio=0):
        for out in resampler.resample(frame):
            chunks.append(out.to_ndarray().reshape(-1))
    for out in resampler.resample(None):
        chunks.append(out.to_ndarray().reshape(-1))
    container.close()
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def wav_bytes(samples: np.ndarray) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes())
    return buf.getvalue()


# ---------------------------------------------------------------- whisper
MODEL_LOCK = threading.Lock()
WHISPER = {"status": "idle", "error": ""}


def whisper_run(audio: np.ndarray, words: bool = False, prompt: str | None = None) -> dict:
    import mlx_whisper

    with MODEL_LOCK:
        WHISPER["status"] = "ready"
        return mlx_whisper.transcribe(
            audio,
            path_or_hf_repo=CFG["whisper_model"],
            language="en",
            word_timestamps=words,
            initial_prompt=prompt,
            condition_on_previous_text=False,
            verbose=None,
        )


def to_sentences(result: dict) -> list[dict]:
    words = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []) or []:
            if w.get("word", "").strip():
                words.append(w)
    if not words:
        return [{"s": round(s["start"], 2), "e": round(s["end"], 2), "text": s["text"].strip()} for s in result.get("segments", []) if s["text"].strip()]
    out, cur = [], []

    def flush():
        if cur:
            text = "".join(w["word"] for w in cur).strip()
            out.append({"s": round(cur[0]["start"], 2), "e": round(cur[-1]["end"], 2), "text": text})
            cur.clear()

    for i, w in enumerate(words):
        if cur and (w["start"] - cur[-1]["end"] > 1.2 or len(cur) >= 32):
            flush()
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        end_punct = re.search(r"[.!?][\"')\]]*$", w["word"].strip())
        if end_punct and len(cur) >= 3:
            flush()
        elif re.search(r"[,;:]$", w["word"].strip()) and len(cur) >= 16 and nxt and nxt["start"] - w["end"] > 0.25:
            flush()
    flush()
    return out


# ---------------------------------------------------------------- fluency metrics
FILLERS = {"um", "umm", "uh", "uhh", "uhm", "erm", "er", "err", "hmm", "hm", "mm", "mmm", "ah", "eh"}
PAUSE = 0.25  # s; silent-pause threshold common in L2 fluency research (de Jong & Bosker 2013)
# Whisper drops disfluencies unless the prompt itself contains them.
FILLER_PROMPT = "Umm, let me think, like, hmm... Okay, uh, so here's what I'm, um, thinking."


def word_list(result: dict) -> list[list]:
    out = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []) or []:
            if w.get("word", "").strip():
                out.append([w["word"].strip(), round(float(w["start"]), 2), round(float(w["end"]), 2)])
    return out


def fluency(words: list[list]) -> dict:
    """Speech rate, fillers per 100 words and mean length of run, all from Whisper word timestamps.

    Speech rate counts words without fillers over the span from first to last word (pauses included).
    A run is a stretch of words not broken by a silent pause >= PAUSE or a filler.
    """
    toks = [(re.sub(r"[^a-z0-9']", "", w.lower()), s, e) for w, s, e in words]
    toks = [t for t in toks if t[0]]
    n_fill = sum(1 for t in toks if t[0] in FILLERS)
    real = len(toks) - n_fill
    span = toks[-1][2] - toks[0][1] if toks else 0.0
    runs, cur, pauses, prev = [], 0, 0, None
    for w, s, e in toks:
        if prev is not None and s - prev >= PAUSE:
            pauses += 1
            if cur:
                runs.append(cur)
                cur = 0
        if w in FILLERS:
            if cur:
                runs.append(cur)
                cur = 0
        else:
            cur += 1
        prev = e
    if cur:
        runs.append(cur)
    return {
        "words": real,
        "fillers": n_fill,
        "pauses": pauses,
        "span": round(span, 1),
        "wpm": round(real / span * 60, 1) if span > 0 else 0,
        "fillers_per100": round(n_fill / real * 100, 1) if real else 0,
        "pauses_per100": round(pauses / real * 100, 1) if real else 0,
        "mlr": round(real / len(runs), 1) if runs else 0,
        "reliable": real >= 20 and span >= 10,
    }


# ---------------------------------------------------------------- recordings archive
CURVE_KINDS = {"talk", "baseline", "r432"}  # free monologues: the only kinds whose metrics go on the curves
KINDS = CURVE_KINDS | {"chat", "shadow", "chunk", "review"}
REC_INDEX: dict[str, dict] = {}


def rec_summary(d: dict) -> dict:
    return {k: v for k, v in d.items() if k != "words"}


def load_recordings() -> None:
    for p in RECS.glob("*.json"):
        try:
            d = json.loads(p.read_text("utf-8"))
            REC_INDEX[d["id"]] = rec_summary(d)
        except Exception:
            continue


def save_recording(raw: bytes, filename: str, samples: np.ndarray, res: dict, text: str, kind: str, line: str, meta: dict) -> dict:
    rid = time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(2)
    suf = Path(filename or "").suffix.lower()
    ext = suf if suf in (".webm", ".m4a", ".ogg", ".wav") else ".webm"
    (RECS / (rid + ext)).write_bytes(raw)
    words = word_list(res)
    d = {
        "id": rid,
        "t": int(time.time() * 1000),
        "date": time.strftime("%Y-%m-%d"),
        "kind": kind,
        "line": line,
        "meta": meta,
        "audio": rid + ext,
        "duration": round(len(samples) / SR, 1),
        "text": text,
        "metrics": fluency(words),
        "words": words,
    }
    tmp = RECS / (rid + ".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False), "utf-8")
    tmp.replace(RECS / (rid + ".json"))
    REC_INDEX[rid] = rec_summary(d)
    return d


def rec_path(rid: str, suffix: str) -> Path:
    if not re.fullmatch(r"[\w-]+", rid) or rid not in REC_INDEX:
        raise HTTPException(404, "找不到这条录音")
    return RECS / (REC_INDEX[rid]["audio"] if suffix == "audio" else rid + ".json")


load_recordings()


def tpath(rel: str) -> Path:
    key = re.sub(r"[^\w\-.]+", "_", rel)[-180:]
    return TRANS / f"{key}.json"


def transcribe_file_inproc(rel: str) -> None:
    """Runs in a separate process (see __main__) so batch work never blocks live speech-to-text."""
    import mlx_whisper

    p = safe_media(rel)
    audio = decode_audio(p)
    res = mlx_whisper.transcribe(audio, path_or_hf_repo=CFG["whisper_model"], language="en", word_timestamps=True,
                                 condition_on_previous_text=False, verbose=None)
    data = {"file": rel, "duration": round(len(audio) / SR, 2), "sentences": to_sentences(res), "created": time.time()}
    tmp = tpath(rel).with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
    tmp.replace(tpath(rel))


LAST_ACTIVE = [0.0]
CURRENT: dict = {}
_seq = [0]
JOBS: "queue.PriorityQueue[tuple[int, int, str]]" = queue.PriorityQueue()
JOB_STATE: dict[str, str] = {}
IDLE_BEFORE_BACKGROUND = 180  # seconds without live use before background transcription resumes


def mark_active():
    """Live use (recording, AI calls) pauses background transcription so speech-to-text stays fast."""
    LAST_ACTIVE[0] = time.time()
    cur = CURRENT.get("job")
    if cur and cur[0] == 1 and CURRENT.get("proc") and CURRENT["proc"].poll() is None:
        CURRENT["killed"] = True
        CURRENT["proc"].terminate()


def transcribe_file(prio: int, rel: str) -> None:
    import subprocess
    import sys

    safe_media(rel)
    JOB_STATE[rel] = "running"
    proc = subprocess.Popen([sys.executable, str(ROOT / "app.py"), "--transcribe", rel], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    CURRENT.update({"job": (prio, rel), "proc": proc, "killed": False})
    _, err = proc.communicate()
    killed = CURRENT.get("killed")
    CURRENT.clear()
    if killed:
        JOB_STATE[rel] = "queued"
        _seq[0] += 1
        JOBS.put((prio, _seq[0], rel))
        return
    if proc.returncode != 0 or not tpath(rel).exists():
        raise RuntimeError(((err or "转写进程失败").strip().splitlines() or ["转写进程失败"])[-1][:200])
    JOB_STATE[rel] = "done"


def worker():
    while True:
        prio, seq, rel = JOBS.get()
        if tpath(rel).exists():
            JOB_STATE[rel] = "done"
            continue
        if prio == 1 and time.time() - LAST_ACTIVE[0] < IDLE_BEFORE_BACKGROUND:
            JOBS.put((prio, seq, rel))
            time.sleep(5)
            continue
        try:
            transcribe_file(prio, rel)
        except Exception as e:  # keep going
            JOB_STATE[rel] = "error: " + str(e)[:200]
            WHISPER["error"] = str(e)[:300]


threading.Thread(target=worker, daemon=True).start()


def warmup():
    try:
        whisper_run(np.zeros(SR, dtype=np.float32))
    except Exception as e:
        WHISPER["error"] = str(e)[:300]


def enqueue(rel: str, front: bool = False):
    if tpath(rel).exists():
        return
    st = JOB_STATE.get(rel)
    if st == "running":
        return
    if st == "queued" and not front:
        return
    JOB_STATE[rel] = "queued"
    _seq[0] += 1
    JOBS.put((0 if front else 1, _seq[0], rel))


# ---------------------------------------------------------------- LLM proxy
def provider(name: str) -> dict:
    p = CFG["providers"].get(name)
    if not p or not p.get("api_key") or not p.get("model"):
        raise HTTPException(400, f"还没在设置里填好「{(p or {}).get('label', name)}」的 API key 和模型名。")
    return p


def extract_json(text: str):
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    a = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
    b = max(text.rfind("}"), text.rfind("]"))
    if a >= 0 and b > a:
        try:
            return json.loads(text[a : b + 1])
        except Exception:
            pass
    raise HTTPException(502, "AI 返回的格式不对，再试一次。")


async def chat_completion(p: dict, messages: list, want_json: bool, stream: bool = False, temperature: float = 0.6) -> str:
    url = p["base_url"].rstrip("/") + "/chat/completions"
    body = {"model": p["model"], "messages": messages, "temperature": temperature}
    if stream:
        body["stream"] = True
        body["stream_options"] = {"include_usage": False}
    headers = {"Authorization": f"Bearer {p['api_key']}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=15)) as c:
            if not stream:
                r = await c.post(url, json=body, headers=headers)
                if r.status_code >= 400:
                    raise HTTPException(502, f"{p.get('label')} 返回错误 {r.status_code}：{r.text[:300]}")
                return r.json()["choices"][0]["message"]["content"] or ""
            parts = []
            async with c.stream("POST", url, json=body, headers=headers) as r:
                if r.status_code >= 400:
                    txt = (await r.aread()).decode("utf-8", "ignore")
                    raise HTTPException(502, f"{p.get('label')} 返回错误 {r.status_code}：{txt[:300]}")
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        ch = json.loads(data)["choices"]
                        if ch and ch[0].get("delta", {}).get("content"):
                            parts.append(ch[0]["delta"]["content"])
                    except Exception:
                        continue
            return "".join(parts)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"连不上 {p.get('label')}：{e.__class__.__name__}。检查网络和接口地址。")


# ---------------------------------------------------------------- app
app = FastAPI()


@app.get("/api/lessons")
def api_lessons():
    return {"lessons": LESSONS, "error": LESSON_ERR}


@app.get("/api/media")
def api_media(path: str):
    return FileResponse(safe_media(path), media_type="audio/mpeg")


@app.get("/api/transcript")
def api_transcript(path: str, ensure: int = 0):
    tp = tpath(path)
    if tp.exists():
        return json.loads(tp.read_text("utf-8"))
    if ensure:
        safe_media(path)
        if JOB_STATE.get(path) != "running":
            mark_active()
        enqueue(path, front=True)
    st = JOB_STATE.get(path, "missing")
    return {"status": st, "queue": JOBS.qsize()}


@app.post("/api/transcribe_all")
def api_transcribe_all():
    n = 0
    for l in LESSONS:
        for k in ("f", "b"):
            if l.get(k) and not tpath(l[k]).exists():
                enqueue(l[k])
                n += 1
    return {"queued": n}


@app.post("/api/stt")
async def api_stt(audio: UploadFile = File(...), ref: str = Form(""), kind: str = Form(""), line: str = Form("daily"), meta: str = Form("{}")):
    """Speech to text. With `kind`, the recording is archived with word timestamps and fluency metrics."""
    mark_active()
    raw = await audio.read()
    try:
        samples = decode_audio(raw)
    except Exception:
        raise HTTPException(400, "这段录音解不开，再录一次试试。")
    if len(samples) < SR * 0.3:
        return {"text": ""}
    if kind and kind not in KINDS:
        raise HTTPException(400, "未知的录音类型")
    prompt = ref[:200] or (FILLER_PROMPT if kind in CURVE_KINDS else None)
    res = await run_blocking(lambda: whisper_run(samples, words=bool(kind), prompt=prompt))
    text = " ".join(s["text"].strip() for s in res.get("segments", [])).strip()
    if not kind:
        return {"text": text}
    try:
        m = json.loads(meta) if len(meta) < 4000 else {}
    except Exception:
        m = {}
    rec = save_recording(raw, audio.filename, samples, res, text, kind, "academic" if line == "academic" else "daily", m if isinstance(m, dict) else {})
    return {"text": text, "id": rec["id"], "metrics": rec["metrics"], "duration": rec["duration"]}


@app.get("/api/recordings")
def api_recordings(kinds: str = "", line: str = ""):
    ks = set(filter(None, kinds.split(",")))
    out = [r for r in REC_INDEX.values() if (not ks or r["kind"] in ks) and (not line or r["line"] == line)]
    return {"recordings": sorted(out, key=lambda r: r["t"], reverse=True)}


@app.get("/api/recordings/{rid}")
def api_recording(rid: str):
    return json.loads(rec_path(rid, "json").read_text("utf-8"))


@app.get("/api/recordings/{rid}/audio")
def api_recording_audio(rid: str):
    p = rec_path(rid, "audio")
    mt = {".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav"}.get(p.suffix, "audio/webm")
    return FileResponse(p, media_type=mt)


async def run_blocking(fn):
    import asyncio

    return await asyncio.get_running_loop().run_in_executor(None, fn)


@app.post("/api/ai/text")
async def api_ai_text(req: Request):
    mark_active()
    body = await req.json()
    name = body.get("provider") or CFG.get("text_provider", "deepseek")
    p = provider(name)
    msgs = body.get("messages") or [{"role": "user", "content": body.get("prompt", "")}]
    want_json = bool(body.get("json"))
    if want_json:
        note = "Reply with one valid JSON value only, no markdown fences, no extra text."
        if msgs and msgs[0].get("role") == "system":
            msgs = [{"role": "system", "content": msgs[0]["content"] + "\n\n" + note}] + msgs[1:]
        else:
            msgs = [{"role": "system", "content": note}] + msgs
    text = await chat_completion(p, msgs, want_json, temperature=float(body.get("temperature", 0.6)))
    return {"json": extract_json(text)} if want_json else {"text": text}


@app.post("/api/ai/audio")
async def api_ai_audio(audio: UploadFile = File(...), prompt: str = Form(...), want_json: int = Form(1)):
    mark_active()
    p = provider("omni")
    raw = await audio.read()
    try:
        samples = decode_audio(raw)
    except Exception:
        raise HTTPException(400, "这段录音解不开，再录一次试试。")
    if len(samples) > SR * 240:
        samples = samples[: SR * 240]
    b64 = base64.b64encode(wav_bytes(samples)).decode()
    msgs = [
        {
            "role": "user",
            "content": [
                {"type": "input_audio", "input_audio": {"data": f"data:;base64,{b64}", "format": "wav"}},
                {"type": "text", "text": prompt + ("\nReply with one valid JSON value only, no markdown fences." if want_json else "")},
            ],
        }
    ]
    text = await chat_completion(p, msgs, bool(want_json), stream=True, temperature=0.3)
    return {"json": extract_json(text)} if want_json else {"text": text}


@app.get("/api/state")
def api_state():
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text("utf-8"))
    return {}


@app.post("/api/state")
async def api_state_save(req: Request):
    LAST_ACTIVE[0] = time.time()
    body = await req.json()
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(body, ensure_ascii=False), "utf-8")
    tmp.replace(STATE_PATH)
    return {"ok": True}


def masked(cfg: dict) -> dict:
    out = json.loads(json.dumps(cfg))
    for p in out["providers"].values():
        k = p.get("api_key", "")
        p["has_key"] = bool(k)
        p["api_key"] = ("••••" + k[-4:]) if k else ""
    return out


@app.get("/api/config")
def api_config():
    return masked(CFG)


@app.post("/api/config")
async def api_config_save(req: Request):
    body = await req.json()
    if "text_provider" in body:
        CFG["text_provider"] = body["text_provider"]
    for name, pv in (body.get("providers") or {}).items():
        dst = CFG["providers"].setdefault(name, {})
        for k in ("base_url", "model"):
            if k in pv:
                dst[k] = str(pv[k]).strip()
        if pv.get("api_key") and not str(pv["api_key"]).startswith("••••"):
            dst["api_key"] = str(pv["api_key"]).strip()
        if pv.get("clear_key"):
            dst["api_key"] = ""
    save_cfg(CFG)
    return masked(CFG)


@app.post("/api/config/test")
async def api_config_test(req: Request):
    name = (await req.json()).get("provider")
    p = provider(name)
    if name == "omni":
        # tiny audio: 0.5 s of silence
        b64 = base64.b64encode(wav_bytes(np.zeros(SR // 2, dtype=np.float32))).decode()
        msgs = [{"role": "user", "content": [{"type": "input_audio", "input_audio": {"data": f"data:;base64,{b64}", "format": "wav"}}, {"type": "text", "text": "Reply with the word OK."}]}]
        text = await chat_completion(p, msgs, False, stream=True)
    else:
        text = await chat_completion(p, [{"role": "user", "content": "Reply with the word OK."}], False)
    return {"ok": True, "reply": text[:80]}


@app.post("/api/config/models")
async def api_config_models(req: Request):
    name = (await req.json()).get("provider")
    p = CFG["providers"].get(name) or {}
    if not p.get("api_key"):
        raise HTTPException(400, "先填 API key。")
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(p["base_url"].rstrip("/") + "/models", headers={"Authorization": f"Bearer {p['api_key']}"})
        if r.status_code >= 400:
            raise HTTPException(502, f"获取模型列表失败 {r.status_code}：{r.text[:200]}")
        return {"models": sorted(m.get("id") for m in r.json().get("data", []) if m.get("id"))}
    except httpx.HTTPError as e:
        raise HTTPException(502, f"连不上：{e.__class__.__name__}")


@app.get("/api/status")
def api_status():
    done = sum(1 for l in LESSONS if tpath(l["f"]).exists())
    return {
        "lessons": len(LESSONS),
        "ielts_transcribed": done,
        "queue": JOBS.qsize(),
        "paused": time.time() - LAST_ACTIVE[0] < IDLE_BEFORE_BACKGROUND,
        "running": [k for k, v in JOB_STATE.items() if v == "running"],
        "whisper": WHISPER,
        "providers": {k: bool(v.get("api_key")) and bool(v.get("model")) for k, v in CFG["providers"].items()},
        "text_provider": CFG.get("text_provider"),
        "lesson_error": LESSON_ERR,
    }


@app.exception_handler(HTTPException)
async def http_err(_, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.middleware("http")
async def no_cache(request: Request, call_next):
    resp = await call_next(request)
    if not request.url.path.startswith("/api/media"):
        resp.headers["Cache-Control"] = "no-cache"
    return resp


app.mount("/", StaticFiles(directory=ROOT / "static", html=True), name="static")

if __name__ == "__main__":
    import sys

    if len(sys.argv) == 3 and sys.argv[1] == "--transcribe":
        transcribe_file_inproc(sys.argv[2])
        sys.exit(0)
    threading.Thread(target=warmup, daemon=True).start()
    api_transcribe_all()  # missing subtitles are generated in the background while the app sits idle
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning")
