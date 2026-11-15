"""对照 NGSL-Spoken 721 词检查课程用词。

python3 tools/check_vocab.py course        检查 static/course.json 里每个单元学习者要说的英文
python3 tools/check_vocab.py syllabus      检查大纲的句型框架，并核对「情境必需词」一列
python3 tools/check_vocab.py text "..."    检查一段文字

词表外的词按单元列出，前面单元已经出现过的不算新词。大纲规定：每节新出现的词表外词不超过 3 个，并且要写进「情境必需词」。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST = ROOT / "tools" / "wordlists" / "ngsl-spoken-1.2.csv"

# Words any lesson may use without counting against the list: names of days and months, greetings,
# and spoken fillers that NGSL-Spoken leaves out.
EXTRA = set("""
monday tuesday wednesday thursday friday saturday sunday mondays fridays weekends
january february march april may june july august september october november december
hello hi bye goodbye oh um uh hmm mr mrs ms
""".split())

# Contractions are split into their full words before lookup.
CONTRACT = {"n't": ["not"], "'m": ["am"], "'re": ["are"], "'s": ["is"], "'ll": ["will"], "'ve": ["have"], "'d": ["would"]}
NEG_BASE = {"can't": "can", "won't": "will", "shan't": "shall", "ain't": "be"}
# The list gives each lemma's forms, but leaves out some irregular ones.
IRREGULAR = {"better": "good", "best": "good", "worse": "bad", "worst": "bad", "children": "child", "people": "person"}


def known(w: str, words: set) -> bool:
    """In the list as given, or a regular inflection (-s, -ed, -ing, -er, -est) of a listed word."""
    if w in words or IRREGULAR.get(w) in words:
        return True
    for end in ("ies", "ied", "ier", "iest"):
        if w.endswith(end) and w[: -len(end)] + "y" in words:
            return True
    for end in ("s", "es", "ed", "d", "ing", "er", "est"):
        if w.endswith(end) and len(w) > len(end) + 2:
            stem = w[: -len(end)]
            if stem in words or stem + "e" in words or (len(stem) > 2 and stem[-1] == stem[-2] and stem[:-1] in words):
                return True
    return False


def load_words() -> set:
    words = set()
    for line in LIST.read_text("utf-8").splitlines():
        words.update(w.strip().lower() for w in line.split(",") if w.strip())
    return words | EXTRA


def tokens(text: str) -> list:
    """Lowercase words of an English string; blanks (___ or ...) and numbers are skipped."""
    text = text.replace("’", "'").replace("‘", "'")
    text = re.sub(r"_+[A-Za-z]*", " ", text)  # a blank, also one with a suffix written on it (___ing)
    out = []
    for raw in re.findall(r"[A-Za-z][A-Za-z'-]*", text):
        w = raw.lower().strip("'-")
        if not w:
            continue
        if w in NEG_BASE:
            out += [NEG_BASE[w], "not"]
            continue
        for end, full in CONTRACT.items():
            if w.endswith(end) and len(w) > len(end):
                out += [w[: -len(end)]] + full
                break
        else:
            out += [p for p in w.split("-") if p]
    return out


def outside(text: str, words: set) -> list:
    seen = []
    for w in tokens(text):
        if not known(w, words) and w not in seen and not (len(w) == 1 and w not in ("a", "i")):
            seen.append(w)
    return seen


def unit_texts(u: dict) -> list:
    """Sentences the learner is asked to say. Sound-drill words (minimal pairs, stress examples) are left out:
    they are chosen for their sounds, not for use."""
    p = u.get("pattern") or {}
    texts = [p.get("frame", "")]
    texts += [s.get("en", "") for s in (p.get("sentences") or []) + (p.get("swaps") or [])]
    return [t for t in texts if t]


def check_course(words: set) -> int:
    units = json.loads((ROOT / "static" / "course.json").read_text("utf-8"))["units"]
    bad, met = 0, set()  # met: words outside the list already introduced by an earlier unit
    for k, u in enumerate(units, 1):
        found = []
        for t in unit_texts(u):
            found += [w for w in outside(t, words) if w not in found]
        new = [w for w in found if w not in met]
        old = [w for w in found if w in met]
        met.update(found)
        flag = "  新词超过 3 个" if len(new) > 3 else ""
        bad += len(new) > 3
        line = "新：" + ("、".join(new) if new else "无") + ("；前面出现过：" + "、".join(old) if old else "")
        print(f"{k:>3} {u.get('id', '')} {u.get('title', '')}  " + line + flag)
    return bad


def check_syllabus(words: set) -> int:
    path = ROOT / "docs" / "rebirth" / "syllabus-stage1.md"
    bad = 0
    for line in path.read_text("utf-8").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 10 or not re.match(r"^\d+", cells[0]):
            continue
        frame, declared = cells[4], cells[9]
        declared_words = set(tokens(declared)) if declared not in ("—", "-") else set()
        # a declared word also covers its inflections (hurt → hurts)
        missing = [w for w in outside(frame, words) if not any(w == d or (w.startswith(d) and len(w) - len(d) <= 3) for d in declared_words)]
        in_list = sorted(w for w in declared_words if known(w, words))
        notes = []
        if missing:
            notes.append("句型里有词表外的词但没写进必需词：" + "、".join(missing))
        if in_list:
            notes.append("写成必需词但其实在词表内：" + "、".join(in_list))
        if len(declared_words - set(in_list)) > 3:
            notes.append("必需词超过 3 个")
        if notes:
            bad += 1
            print(f"第 {cells[0]} 节：" + "；".join(notes))
    if not bad:
        print("大纲的句型框架和必需词一列都对得上。")
    return bad


def main() -> None:
    words = load_words()
    mode = sys.argv[1] if len(sys.argv) > 1 else "course"
    if mode == "course":
        check_course(words)
    elif mode == "syllabus":
        check_syllabus(words)
    elif mode == "text":
        print("、".join(outside(" ".join(sys.argv[2:]), words)) or "全部在词表内")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
