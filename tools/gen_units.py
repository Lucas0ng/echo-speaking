"""按阶段 1 大纲批量生成课程单元草稿（第 3 期：内容量产）。

python3 tools/gen_units.py 6 20          生成第 6–20 节（综合课和里程碑课跳过），写到 docs/rebirth/drafts/
python3 tools/gen_units.py 6 20 --check  只检查已有草稿，不调用模型

模型走本机服务的 /api/ai/text（设置里配置的 DeepSeek，答案缓存在 data/ai_cache）。所以先打开「回声」。
每个单元生成后由程序检查：格式、句子长度、词表、复现。不过关就把问题告诉模型重写，最多 3 次。
检查的规则见 check_unit()；自然度由另一个模型审，不在这里。
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_vocab as cv  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SYLLABUS = ROOT / "docs" / "rebirth" / "syllabus-stage1.md"
COURSE = ROOT / "static" / "course.json"
OUT = ROOT / "docs" / "rebirth" / "drafts" / "stage1-units.json"
API = "http://127.0.0.1:8765/api/ai/text"
FIRST_NEW_ID = 11  # s1-u01..u10 are the trial units; new units are numbered on from s1-u11


# ---------------------------------------------------------------- syllabus
def syllabus_rows() -> dict:
    rows = {}
    for line in SYLLABUS.read_text("utf-8").splitlines():
        c = [x.strip() for x in line.strip().strip("|").split("|")]
        if len(c) != 10 or not re.match(r"^\d+", c[0]):
            continue
        n = int(re.match(r"\d+", c[0]).group())
        rows[n] = {
            "n": n, "kind": "mix" if "综合" in c[0] else "milestone" if "里程碑" in c[0] else "unit", "trial": "★" in c[0],
            "level": int(c[2]), "can": c[3], "frame": c[4], "sound": c[5], "use": c[6], "recur": recur_list(c[7]),
            "tags": c[8].split(), "needed": [] if c[9] in ("—", "-") else [w.strip() for w in c[9].split("、") if w.strip()],
        }
    return rows


def recur_list(cell: str) -> list:
    out = []
    for part in re.split(r"[、,]", cell):
        m = re.match(r"(\d+)(?:–(\d+))?", part.strip())
        if m:
            a, b = int(m.group(1)), int(m.group(2) or m.group(1))
            out += list(range(a, b + 1))
    return out


def frame_alts(frame: str) -> list:
    """Syllabus frame → list of alternatives, each a list of fixed word sequences (blanks dropped)."""
    alts = []
    for alt in frame.split(" / "):
        alt = re.sub(r"\(.*?\)", " ", alt)
        parts = [" ".join(cv.tokens(p)) for p in re.split(r"_+[A-Za-z]*|\.\.\.", alt)]
        parts = [p for p in parts if p]
        if parts:
            alts.append(parts)
    return alts


def uses_frame(text: str, frame: str) -> bool:
    t = " " + " ".join(cv.tokens(text)) + " "
    for parts in frame_alts(frame):
        at, ok = 0, True
        for p in parts:
            i = t.find(" " + p + " ", at)
            if i < 0:
                ok = False
                break
            at = i + len(p) + 1
        if ok:
            return True
    return False


# ---------------------------------------------------------------- prompt
SPEC = """A unit is one 25-minute lesson. Return ONE JSON object with exactly these fields:
{
  "id": "<given>", "stage": 1, "level": <given>, "tags": [<given>],
  "title": "2–5 个汉字的课名，像「问有没有」「说我需要」",
  "can": "能……。（照大纲那一句，可以稍微润色）",
  "sound": {
    "title": "<given sound focus>",
    "note_zh": "2–3 行中文讲怎么发，**加粗**要点，用 \\n 换行",
    "link": {"label": "", "url": ""},
    "items": [ {"text": "word or phrase or sentence", "mark": "stress in CAPS, linking ‿, pause ' / '"} ]   // 3–5 items, from words to a sentence; the LAST item must be one of this unit's pattern sentences, word for word
  },
  "pattern": {
    "frame": "the target pattern with ... for the open slot, e.g. \\"Where's the ...?\\" — ONE frame only, no ' / ' alternatives",
    "note_zh": "2–3 行中文：什么时候用、怎么接、一个常见错误。**加粗**要点，用 \\n 换行",
    "sentences": [ {"cue_zh": "自然的中文，不是逐词翻译", "cue_en": "1–3 English key words", "en": "the sentence"} ],   // 6 sentences
    "swaps": [ same shape ]   // 3 sentences: the same frame with different content
  },
  "task": {
    "scene_zh": "中文，第二人称，1–2 句：在哪、要办成什么",
    "role": "English instructions for the AI partner: who they are, what they ask, and that they should give natural chances to use the target pattern and the review patterns listed below",
    "opener": "the partner's first line, English, short",
    "goal_zh": "用 <frame> ……（一个能判定的目标）"
  }
}"""

RULES = """Rules:
1. Every English sentence: at most 12 words, natural spoken American English that a native speaker would really say in that situation. No textbook-stiff lines.
2. Words: use only words from the WORD LIST below, the NEEDED words given for this unit, and the ALREADY-MET words. If a sentence truly needs another everyday word, you may use at most 2 such extra words in the whole unit.
3. Review: sentences 5 and 6 must each COMBINE today's pattern with one REVIEW pattern in a short two-part line (e.g. "I'm here for the interview. Where's the elevator?"). Together they must cover every pattern listed under MUST REVIEW. Mention the other review patterns in task.role so the partner creates chances for them.
4. The 6 sentences go from easy to harder. Sentences 1–4 use today's pattern alone. Vary the content; do not repeat an object.
5. The sound items practise the given sound focus; the last item is one of this unit's pattern sentences, copied exactly.
6. cue_zh must be what a Chinese speaker would naturally say, and must not give away the English structure.
7. Do not copy sentences from commercial textbooks. Do not put URLs anywhere (link stays empty).
8. No grades or percentages anywhere."""


def build_prompt(row: dict, rows: dict, uid: str, met: list, words_csv: str, ref_unit: dict, sound_ref: dict | None) -> str:
    n = row["n"]
    must = [r for r in row["recur"] if n - 3 <= r < n and rows.get(r, {}).get("kind") == "unit"]
    other = [r for r in row["recur"] if r not in must and rows.get(r, {}).get("kind") == "unit"]
    lines = [
        "You write one lesson unit for an English speaking course for adult Chinese learners (A1–A2).",
        "The learner reads Chinese cues and must SAY the English without looking. Placement showed three weak spots: missing or misused 'be' (\"I'm come\", \"Where the nearest...\"), everyday words they cannot retrieve, and fixed chunks they rebuild word by word.",
        "", SPEC, "", RULES, "",
        f"THIS UNIT: id {uid}, lesson {n}, level {row['level']}, tags {row['tags']}",
        f"Can-do: {row['can']}",
        f"Target pattern (from the syllabus): {row['frame']}",
        f"Sound focus: {row['sound']}",
        f"Task idea for the role-play: {row['use']}",
        f"NEEDED words (outside the word list but allowed): {', '.join(row['needed']) or 'none'}",
        "MUST REVIEW (each must appear in sentence 5 or 6): " + ("; ".join(f"lesson {r}: {rows[r]['frame']}" for r in must) or "none"),
        "Other review patterns (put them in task.role): " + ("; ".join(f"lesson {r}: {rows[r]['frame']}" for r in other) or "none"),
        f"ALREADY-MET words (allowed): {', '.join(met) or 'none'}",
    ]
    if sound_ref:
        lines += ["", "An earlier unit already wrote this sound focus. Reuse its title, note_zh and link exactly; write new items:", json.dumps({k: sound_ref[k] for k in ("title", "note_zh", "link")}, ensure_ascii=False)]
    lines += ["", "STYLE EXAMPLE (an existing unit; match its tone and length, not its content):", json.dumps(ref_unit, ensure_ascii=False),
              "", "WORD LIST (NGSL-Spoken, each line = a word and its forms):", words_csv]
    return "\n".join(lines)


MIX_SPEC = """This is a MIX lesson: no new pattern. The learner uses the block's patterns together. Return ONE JSON object:
{
  "id": "<given>", "kind": "mix", "stage": 1, "level": <given>, "tags": [],
  "title": "2–6 个汉字，如「一趟出门」",
  "can": "能……。（照大纲那一句）",
  "sound": { "title": "<given>", "note_zh": "...", "link": {"label": "", "url": ""}, "items": [3–5 items; the last one is one of this lesson's sentences, copied exactly] },
  "pattern": {
    "frame": "本块句型混着用",
    "frames": [<given list, copied exactly>],
    "note_zh": "2–3 行中文：这节把哪几个说法串起来用，提醒一个容易混的地方",
    "sentences": [ {"cue_zh": "...", "cue_en": "...", "en": "..."} ],   // 6 sentences, each a short two-part line joining TWO different block patterns, following the trip in the task; together they use at least 6 different block patterns
    "swaps": []
  },
  "task": { "scene_zh": "...", "role": "English: who the partner(s) are; the scene moves through several stops so the learner needs several different block patterns; give natural chances for them", "opener": "...", "goal_zh": "用上本块至少 3 个不同的句型，办完……" }
}"""


def build_mix_prompt(row: dict, uid: str, frames: list, met: list, words_csv: str, ref_unit: dict, sound_ref: dict | None) -> str:
    lines = [
        "You write one MIX lesson for an English speaking course for adult Chinese learners (A1–A2).",
        "", MIX_SPEC, "", RULES.split("\n3.")[0] + "\n5. The sound items practise the given sound focus.\n6. cue_zh must be natural Chinese and must not give away the English structure.\n7. No URLs, no grades.", "",
        f"THIS LESSON: id {uid}, lesson {row['n']}, level {row['level']}",
        f"Can-do: {row['can']}",
        f"Sound focus: {row['sound']}",
        f"Task idea: {row['use']}",
        "Block patterns (copy into pattern.frames exactly): " + json.dumps(frames, ensure_ascii=False),
        f"NEEDED words: {', '.join(row['needed']) or 'none'}",
        f"ALREADY-MET words (allowed): {', '.join(met) or 'none'}",
    ]
    if sound_ref:
        lines += ["", "Reuse this sound block's title, note_zh and link exactly; write new items:", json.dumps({k: sound_ref[k] for k in ("title", "note_zh", "link")}, ensure_ascii=False)]
    lines += ["", "STYLE EXAMPLE (an ordinary unit):", json.dumps(ref_unit, ensure_ascii=False), "", "WORD LIST:", words_csv]
    return "\n".join(lines)


def check_mix(u: dict, frames: list, row: dict, met: set, words: set) -> list:
    problems = []
    p, s = u.get("pattern") or {}, u.get("sound") or {}
    sents, items = p.get("sentences") or [], s.get("items") or []
    if u.get("kind") != "mix":
        problems.append('kind must be "mix"')
    if p.get("frames") != frames:
        problems.append("pattern.frames must be exactly the given block patterns")
    if len(sents) != 6:
        problems.append(f"pattern.sentences has {len(sents)} sentences, need 6")
    if not 3 <= len(items) <= 5:
        problems.append(f"sound.items has {len(items)} items, need 3–5")
    ens = [x.get("en", "") for x in sents]
    if items and items[-1].get("text") not in ens:
        problems.append("the last sound item must be one of the sentences, copied exactly")
    for x in sents:
        if len(x.get("en", "").split()) > 14:  # a mix line joins two patterns
            problems.append(f"too long: {x.get('en')}")
        hit = [f for f in frames if uses_frame(x.get("en", ""), f)]
        if len(hit) < 2:
            problems.append(f"each sentence must join two different block patterns: {x.get('en')}")
    used = {f for e in ens for f in frames if uses_frame(e, f)}
    if len(used) < 6:
        problems.append(f"the sentences use only {len(used)} different block patterns, need at least 6")
    allowed = met | {w.lower() for w in row["needed"]}
    extra = []
    for e in ens:
        extra += [w for w in cv.outside(e, words) if w not in allowed and not any(w.startswith(a) and len(w) - len(a) <= 3 for a in allowed) and w not in extra]
    if len(extra) > 2:
        problems.append("too many words outside the word list (max 2 extra): " + ", ".join(extra))
    return problems


def ask(prompt: str, feedback: list) -> dict:
    msgs = [{"role": "user", "content": prompt}]
    for prev, problems in feedback:
        msgs += [{"role": "assistant", "content": json.dumps(prev, ensure_ascii=False)},
                 {"role": "user", "content": "Fix these problems and return the whole unit again as JSON:\n- " + "\n- ".join(problems)}]
    body = json.dumps({"json": True, "messages": msgs, "temperature": 0.7, "think": True, "cache": True}).encode()
    req = urllib.request.Request(API, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())["json"]


# ---------------------------------------------------------------- checks
def check_unit(u: dict, row: dict, rows: dict, met: set, words: set) -> list:
    problems = []
    p, s, t = u.get("pattern") or {}, u.get("sound") or {}, u.get("task") or {}
    sents, swaps, items = p.get("sentences") or [], p.get("swaps") or [], s.get("items") or []
    if len(sents) != 6:
        problems.append(f"pattern.sentences has {len(sents)} sentences, need 6")
    if not 2 <= len(swaps) <= 3:
        problems.append(f"pattern.swaps has {len(swaps)} sentences, need 2–3")
    if not 3 <= len(items) <= 5:
        problems.append(f"sound.items has {len(items)} items, need 3–5")
    frame = p.get("frame", "")
    if "..." not in frame or " / " in frame:
        problems.append('pattern.frame must contain "..." and only one form, no " / "')
    for k in ("title", "can"):
        if not u.get(k):
            problems.append(f"{k} is empty")
    for k in ("scene_zh", "role", "opener", "goal_zh"):
        if not t.get(k):
            problems.append(f"task.{k} is empty")
    if (s.get("link") or {}).get("url") and not row.get("_link_ok"):
        problems.append("sound.link.url must stay empty")
    lines = sents + swaps
    for x in lines:
        if not all(x.get(k) for k in ("cue_zh", "cue_en", "en")):
            problems.append(f"a sentence is missing cue_zh, cue_en or en: {x}")
        if len(x.get("en", "").split()) > 12:
            problems.append(f"too long (max 12 words): {x.get('en')}")
        if re.search(r"[A-Za-z]", x.get("cue_zh", "")) and not re.search(r"[一-鿿]", x.get("cue_zh", "")):
            problems.append(f"cue_zh is not Chinese: {x.get('cue_zh')}")
    ens = [x.get("en", "") for x in lines]
    if items and items[-1].get("text") not in ens:
        problems.append("the last sound item must be one of the pattern sentences, copied exactly")
    for x in sents[:4] + swaps:
        if not uses_frame(x.get("en", ""), row["frame"]):
            problems.append(f"does not use today's pattern {row['frame']}: {x.get('en')}")
    n = row["n"]
    must = [r for r in row["recur"] if n - 3 <= r < n and rows.get(r, {}).get("kind") == "unit"]
    for r in must:
        if not any(uses_frame(e, rows[r]["frame"]) for e in ens[4:6]):
            problems.append(f"sentence 5 or 6 must also use the review pattern of lesson {r}: {rows[r]['frame']}")
    allowed = met | {w.lower() for w in row["needed"]}
    extra = []
    for e in ens:
        extra += [w for w in cv.outside(e, words) if w not in allowed and not any(w.startswith(a) and len(w) - len(a) <= 3 for a in allowed) and w not in extra]
    if len(extra) > 2:
        problems.append("too many words outside the word list (max 2 extra): " + ", ".join(extra))
    return problems


def off_list(u: dict, words: set) -> list:
    out = []
    for e in cv.unit_texts(u):
        out += [w for w in cv.outside(e, words) if w not in out]
    return out


# ---------------------------------------------------------------- main
TRIAL_AT = {1: "s1-u01", 2: "s1-u02", 3: "s1-u04", 4: "s1-u05", 5: "s1-u08"}  # lessons 1–5 are trial units


def unit_frame(n: int, course: list, have: dict):
    if n in TRIAL_AT:
        return next(u["pattern"]["frame"] for u in course if u["id"] == TRIAL_AT[n])
    return have[n]["unit"]["pattern"]["frame"] if n in have else None
def main() -> None:
    a, b = int(sys.argv[1]), int(sys.argv[2])
    only_check = "--check" in sys.argv
    rows, words = syllabus_rows(), cv.load_words()
    words_csv = cv.LIST.read_text("utf-8")
    course = json.loads(COURSE.read_text("utf-8"))["units"]
    by_title = {u["sound"]["title"]: u["sound"] for u in course if u.get("sound")}
    ref_unit = next(u for u in course if u["id"] == "s1-u04")
    drafts = json.loads(OUT.read_text("utf-8")) if OUT.exists() else {"units": []}
    have = {u["lesson"]: u for u in drafts["units"]}

    # words already met: off-list words of the units taught before lesson a (trial units 1–5, then drafts)
    met = set()
    for u in course[:5]:
        met.update(off_list(u, words))
    for n in sorted(have):
        if n < a:
            met.update(off_list(have[n]["unit"], words))

    report = []
    for n in range(a, b + 1):
        row = rows[n]
        if row["kind"] == "milestone" or row["trial"]:
            continue
        mix = row["kind"] == "mix"
        if mix:
            uid = f"s1-m{n:03d}"
            block = range(n - 9, n)
            frames = [unit_frame(k, course, have) for k in block]
            if None in frames:
                print(f"lesson {n}: skipped, units {block.start}–{block.stop - 1} are not all written yet")
                continue
        else:
            uid = f"s1-u{FIRST_NEW_ID + sum(1 for k in range(6, n) if rows[k]['kind'] == 'unit' and not rows[k]['trial']):02d}"
        sound_key = next((k for k in by_title if k.replace(" ", "") == row["sound"].replace(" ", "")), None)
        checker = (lambda u: check_mix(u, frames, row, met, words)) if mix else (lambda u: check_unit(u, row, rows, met, words))
        row["_link_ok"] = bool(sound_key)
        if only_check:
            unit = have[n]["unit"]
            problems = checker(unit)
        else:
            prompt = (build_mix_prompt(row, uid, frames, sorted(met), words_csv, ref_unit, by_title.get(sound_key)) if mix
                      else build_prompt(row, rows, uid, sorted(met), words_csv, ref_unit, by_title.get(sound_key)))
            feedback, unit, problems = [], None, ["not generated"]
            for attempt in range(3):
                unit = ask(prompt, feedback)
                unit.update({"id": uid, "stage": 1, "level": row["level"], "tags": row["tags"]})
                if mix:
                    unit["kind"] = "mix"
                if sound_key:
                    unit["sound"]["link"] = by_title[sound_key].get("link", {"label": "", "url": ""})
                row["_link_ok"] = bool(sound_key)
                problems = checker(unit)
                print(f"lesson {n} {uid} attempt {attempt + 1}: " + ("ok" if not problems else f"{len(problems)} problems"), flush=True)
                if not problems:
                    break
                feedback.append((unit, problems))
            have[n] = {"lesson": n, "unit": unit}
            drafts["units"] = [have[k] for k in sorted(have)]
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps(drafts, ensure_ascii=False, indent=2) + "\n", "utf-8")
        new_words = [w for w in off_list(unit, words) if w not in met]
        met.update(new_words)
        report.append((n, unit["id"], unit.get("title", ""), problems, new_words))

    for n, uid, title, problems, new_words in report:
        print(f"第 {n} 节 {uid} {title}：" + ("通过" if not problems else "；".join(problems)) + ("　新词：" + "、".join(new_words) if new_words else ""))


if __name__ == "__main__":
    main()
