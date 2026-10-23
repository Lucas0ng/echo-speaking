"""从 BBC Learning English 和 IELTSCast 的官方 RSS 下载课程音频。

音频仅供个人学习使用，版权归原发布方所有。

用法：
    python3 tools/download_lessons.py
    python3 tools/download_lessons.py --dir ~/Downloads/回声课程音频
    python3 tools/download_lessons.py --bbc 50 --max-files 2
    python3 tools/download_lessons.py --dry-run

默认目录取项目根目录 config.json 的 media_dir；没有配置时用
~/Downloads/回声课程音频。--bbc N 只下载日期最新的 N 集 BBC（0 表示全部）。
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config.json"
FALLBACK_DIR = "~/Downloads/回声课程音频"

IE_DIR = "IELTS Speaking Shadowing - IELTSCast"
BB_DIR = "BBC The English We Speak"
IE_FEED = "https://ieltscast.libsyn.com/rss"
BB_FEED = "https://podcasts.files.bbci.co.uk/p02pc9zn.rss"

UA = "Mozilla/5.0 (Macintosh) Echo-speaking-practice"
TIMEOUT = 60
FIELDS = ["title", "date", "url", "filename", "expected_bytes", "status"]

_BAD_CHARS = re.compile(r'[\x00-\x1f\x7f/\\:*?"<>|]')
_SPACES = re.compile(r"\s+")


def _default_dir() -> Path:
    """只从 config.json 取 media_dir，不碰其他字段。"""
    value = FALLBACK_DIR
    if CONFIG_PATH.exists():
        try:
            cfg = json.loads(CONFIG_PATH.read_text("utf-8"))
            media_dir = cfg.get("media_dir")
            if isinstance(media_dir, str) and media_dir.strip():
                value = media_dir
        except Exception:
            pass
    return Path(value).expanduser()


def _fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child(item: ET.Element, name: str) -> ET.Element | None:
    for child in item:
        if _local(child.tag) == name:
            return child
    return None


def _parse_date(pub_date: str) -> str:
    try:
        return parsedate_to_datetime(pub_date).strftime("%Y-%m-%d")
    except Exception:
        return "undated"


def _clean_title(title: str) -> str:
    text = _SPACES.sub(" ", _BAD_CHARS.sub(" ", title)).strip()
    return (text or "episode")[:140]


def _has_file(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def _parse_feed(raw: bytes) -> list[dict]:
    """按 RSS 原顺序取出每一集，并生成本地文件名。"""
    root = ET.fromstring(raw)
    records: list[dict] = []
    seen: dict[str, int] = {}

    for item in root.iter():
        if _local(item.tag) != "item":
            continue
        title_node = _child(item, "title")
        date_node = _child(item, "pubDate")
        enclosure = _child(item, "enclosure")
        if enclosure is None:
            continue

        url = (enclosure.get("url") or "").strip()
        if not url:
            continue
        if url.startswith("http://"):
            url = "https://" + url[len("http://"):]

        title = (title_node.text or "").strip() if title_node is not None else ""
        pub_date = (date_node.text or "").strip() if date_node is not None else ""
        date = _parse_date(pub_date)
        clean = _clean_title(title)
        key = f"{date} - {clean}"

        seen[key] = seen.get(key, 0) + 1
        suffix = f" ({seen[key]})" if seen[key] > 1 else ""
        records.append(
            {
                "title": title,
                "date": date,
                "url": url,
                "filename": key + suffix + ".mp3",
                "expected_bytes": enclosure.get("length") or "",
                "status": "download",
                "key": key,
            }
        )
    return records


def _write_manifest(folder: Path, records: list[dict]) -> None:
    with (folder / "manifest.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        for record in records:
            writer.writerow({field: record[field] for field in FIELDS})


def _download(url: str, dest: Path, part: Path) -> int:
    """流式下载到 .part，成功后改名；失败重试一次。返回文件字节数。"""
    error: Exception | None = None
    for _ in range(2):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                with part.open("wb") as f:
                    while True:
                        chunk = response.read(256 * 1024)
                        if not chunk:
                            break
                        f.write(chunk)
            size = part.stat().st_size
            if size <= 0:
                raise OSError("下载到的文件是空的")
            part.replace(dest)
            return size
        except Exception as exc:
            error = exc
            part.unlink(missing_ok=True)
    assert error is not None
    raise error


def _summary(records: list[dict], new_bytes: int) -> dict:
    counts = {
        status: sum(1 for record in records if record["status"] == status)
        for status in ("existing", "downloaded", "failed", "skipped")
    }
    counts["new_bytes"] = new_bytes
    return counts


def _run_source(
    label: str,
    feed_url: str,
    folder_name: str,
    base_dir: Path,
    bbc_limit: int | None,
    max_files: int,
    dry_run: bool,
) -> tuple[dict | None, bool]:
    try:
        raw = _fetch(feed_url)
    except Exception as exc:
        print(f"{label}：RSS 获取失败：{exc}", file=sys.stderr)
        return None, False

    folder = base_dir / folder_name
    try:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "official-feed.rss").write_bytes(raw)
    except OSError as exc:
        print(f"{label}：无法写入 {folder}：{exc}", file=sys.stderr)
        return None, False

    try:
        records = _parse_feed(raw)
    except Exception as exc:
        print(f"{label}：RSS 解析失败：{exc}", file=sys.stderr)
        return None, False

    # 只看最新的 N 集；清单里仍然列出全部 item。
    selected = set(range(len(records)))
    if bbc_limit is not None and bbc_limit > 0 and len(records) > bbc_limit:
        ranked = sorted(
            range(len(records)),
            key=lambda i: (records[i]["date"] != "undated", records[i]["date"]),
            reverse=True,
        )
        selected = set(ranked[:bbc_limit])

    for index, record in enumerate(records):
        if _has_file(folder / record["filename"]):
            record["status"] = "existing"
        elif index not in selected:
            record["status"] = "skipped"

    candidates = [record for record in records if record["status"] == "download"]
    if bbc_limit is None:
        # 回声按日期从早到晚给 IELTSCast 编课号：从最早的一集下起，中途关掉时第 1、2、3 课已经能用
        candidates.sort(key=lambda record: record["date"])
    if max_files > 0:
        for record in candidates[max_files:]:
            record["status"] = "skipped"
        candidates = candidates[:max_files]

    _write_manifest(folder, records)
    if dry_run:
        for record in records:
            if record["status"] == "download":
                record["status"] = "skipped"
        _write_manifest(folder, records)
        print(f"{label}：已取回 RSS（共 {len(records)} 集），只写清单，不下载。")
        return _summary(records, 0), True

    new_bytes = 0
    total = len(candidates)
    for index, record in enumerate(candidates, 1):
        dest = folder / record["filename"]
        part = dest.with_name(dest.name + ".part")
        try:
            size = _download(record["url"], dest, part)
        except Exception as exc:
            record["status"] = "failed"
            print(f"[{index}/{total}] {record['key']} ... 失败：{exc}", file=sys.stderr)
        else:
            record["status"] = "downloaded"
            new_bytes += size
            print(f"[{index}/{total}] {record['key']} ... {size / (1024 * 1024):.1f} MB")

    _write_manifest(folder, records)
    return _summary(records, new_bytes), True


def main() -> int:
    parser = argparse.ArgumentParser(description="从官方 RSS 下载回声的课程音频")
    parser.add_argument("--dir", help="音频目录（默认读 config.json 的 media_dir）")
    parser.add_argument("--bbc", type=int, default=150, help="BBC 只下载最新 N 集，0 为全部")
    parser.add_argument("--max-files", type=int, default=0, help="每个源最多新下载 K 个，0 为不限")
    parser.add_argument("--dry-run", action="store_true", help="只取 RSS、写清单，不下载音频")
    args = parser.parse_args()

    base_dir = Path(args.dir).expanduser() if args.dir else _default_dir()
    print(f"课程音频目录：{base_dir}")
    if args.dry_run:
        print("dry-run：只写清单，不下载音频。")

    sources = [
        ("IELTSCast", IE_FEED, IE_DIR, None),
        ("BBC The English We Speak", BB_FEED, BB_DIR, args.bbc),
    ]
    feed_ok = True
    for label, feed_url, folder_name, bbc_limit in sources:
        stats, ok = _run_source(
            label,
            feed_url,
            folder_name,
            base_dir,
            bbc_limit,
            max(0, args.max_files),
            args.dry_run,
        )
        feed_ok = feed_ok and ok
        if stats is not None:
            print(
                f"{label}：已有 {stats['existing']} / 新下载 {stats['downloaded']} / "
                f"失败 {stats['failed']} / 跳过 {stats['skipped']}；"
                f"新下载共 {stats['new_bytes'] / (1024 * 1024):.1f} MB。"
            )

    print("打开回声即可看到课程。")
    return 0 if feed_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
