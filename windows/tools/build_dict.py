"""把 ECDICT 的 CSV 转成离线查词用的 SQLite 库。

用法：.venv/bin/python tools/build_dict.py
输入：data/dict/ecdict.csv
输出：data/dict/ecdict.sqlite（先写 .tmp，成功后替换）
"""
from __future__ import annotations

import csv
import os
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "dict" / "ecdict.csv"
DB_PATH = ROOT / "data" / "dict" / "ecdict.sqlite"
TMP_PATH = DB_PATH.with_name(DB_PATH.name + ".tmp")

# exchange 里的词形类型；按这个顺序把 types 排成稳定、好读的字符串
TYPE_ORDER = ("p", "d", "i", "3", "s", "r", "t")
TYPE_BITS = {t: 1 << i for i, t in enumerate(TYPE_ORDER)}

WORD_SQL = (
    "INSERT INTO words(k, word, phonetic, translation, tag, frq, collins, oxford, exchange) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
)
FORM_SQL = "INSERT INTO forms(form, lemma, types) VALUES (?, ?, ?)"


def _int(v: str | None) -> int:
    try:
        return int((v or "").strip())
    except ValueError:
        return 0


def _types_text(bits: int) -> str:
    return " ".join(t for t in TYPE_ORDER if bits & TYPE_BITS[t])


def main() -> None:
    start = time.perf_counter()
    if not CSV_PATH.exists():
        sys.exit(f"找不到 {CSV_PATH}")

    TMP_PATH.unlink(missing_ok=True)
    conn = sqlite3.connect(TMP_PATH)
    try:
        conn.isolation_level = None  # 自己控制唯一一次事务
        conn.execute("PRAGMA journal_mode=OFF")
        conn.execute("PRAGMA synchronous=OFF")
        conn.execute("PRAGMA cache_size=-200000")
        conn.execute(
            "CREATE TABLE words ("
            "k TEXT, word TEXT, phonetic TEXT, translation TEXT, tag TEXT, "
            "frq INTEGER, collins INTEGER, oxford INTEGER, exchange TEXT)"
        )
        conn.execute("CREATE TABLE forms (form TEXT, lemma TEXT, types TEXT)")

        conn.execute("BEGIN")
        words: list[tuple] = []
        forms: dict[tuple[str, str], int] = {}
        total = inserted = skipped = 0

        def flush_words() -> None:
            if words:
                conn.executemany(WORD_SQL, words)
                words.clear()

        with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            next(reader, None)  # 表头
            for row in reader:
                total += 1
                if len(row) < 11:
                    skipped += 1
                    continue
                word = row[0].strip()
                translation = row[3]
                if not word or not translation.strip():
                    skipped += 1
                    continue

                exchange = row[10].strip()
                words.append(
                    (
                        word.lower(),
                        word,
                        row[1].strip(),
                        translation,
                        row[7].strip(),
                        _int(row[9]),
                        _int(row[5]),
                        _int(row[6]),
                        exchange,
                    )
                )
                inserted += 1

                # 同一行里同一个变形可能带多个类型（cooked = p + d），先合并成本行的位掩码
                if exchange:
                    local: dict[str, int] = {}
                    for part in exchange.split("/"):
                        if ":" not in part:
                            continue
                        typ, form = part.split(":", 1)
                        typ = typ.strip()
                        if not typ or typ in ("0", "1"):
                            continue
                        if any(ch not in TYPE_BITS for ch in typ):
                            continue
                        form = form.strip().lower()
                        if not form or form == word.lower():
                            continue
                        bits = 0
                        for ch in typ:
                            bits |= TYPE_BITS[ch]
                        local[form] = local.get(form, 0) | bits
                    for form, bits in local.items():
                        key = (form, word)
                        forms[key] = forms.get(key, 0) | bits

                if len(words) >= 50000:
                    flush_words()

        flush_words()
        conn.executemany(FORM_SQL, ((f, l, _types_text(b)) for (f, l), b in forms.items()))
        conn.execute("CREATE INDEX words_k ON words(k)")
        conn.execute("CREATE INDEX forms_form ON forms(form)")
        conn.commit()
    except BaseException:
        conn.close()
        TMP_PATH.unlink(missing_ok=True)
        raise
    conn.close()

    os.replace(TMP_PATH, DB_PATH)
    elapsed = time.perf_counter() - start
    print(
        f"共读取 {total} 行，写入 {inserted} 个词条（跳过 {skipped} 行）、"
        f"{len(forms)} 条词形，用时 {elapsed:.1f} 秒。"
    )
    print(f"已生成 {DB_PATH}")


if __name__ == "__main__":
    main()
