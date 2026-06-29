#!/usr/bin/env python3
"""
将 Agent Sidenote 导出的 JSONL 转为 Obsidian Markdown。

用法：
  python jsonl_to_md.py --input notes.jsonl --output ~/Note/00_Inbox/
  python jsonl_to_md.py --input notes.jsonl --config config.yaml --dry-run
  python jsonl_to_md.py --input notes.jsonl --merge-by topic+url
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

STATE_FILENAME = ".pipeline-state.json"

NOTE_TYPE_LABELS = {
    "general": "通用",
    "concept": "解释概念",
    "debug": "调试记录",
    "code": "代码方案",
    "paper": "论文/学习",
    "interview": "面试准备",
    "todo": "TODO",
}

MARK_LABELS = {
    "important": "重要",
    "concept": "概念",
    "reusable-code": "可复用代码",
    "todo": "待办",
}


def load_yaml_config(path: Path) -> dict:
    config: dict = {}
    if not path.exists():
        return config
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        config[key.strip()] = value.strip().strip('"').strip("'")
    return config


def read_jsonl(path: Path) -> list[dict]:
    records: list[dict] = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        text = line.strip()
        if not text:
            continue
        try:
            records.append(json.loads(text))
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{lineno} JSON 解析失败: {exc}") from exc
    return records


RECORD_FILE_GLOBS = ("*.jsonl", "*.ndjson", "*.txt")


def looks_like_jsonl_file(path: Path) -> bool:
    suffix = path.suffix.lower()
    if suffix in (".jsonl", ".ndjson"):
        return True
    if suffix != ".txt":
        return False
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if not text:
                continue
            obj = json.loads(text)
            return isinstance(obj, dict) and obj.get("schema_version") is not None
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return False
    return False


def list_record_jsonl_paths(record_dir: Path) -> set[Path]:
    if not record_dir.exists():
        return set()
    paths: set[Path] = set()
    for pattern in RECORD_FILE_GLOBS:
        for candidate in record_dir.glob(pattern):
            if candidate.is_file() and looks_like_jsonl_file(candidate):
                paths.add(candidate.resolve())
    return paths


def sanitize_filename(text: str, max_len: int = 40) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]', "_", text or "未命名")
    cleaned = re.sub(r"\s+", "_", cleaned).strip("._")
    return (cleaned or "未命名")[:max_len]


def parse_time(value: str, tz_name: str) -> datetime:
    if not value:
        return datetime.now(ZoneInfo(tz_name))
    normalized = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(ZoneInfo(tz_name))


def simple_hash(text: str) -> str:
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return f"{h:08x}"


def compute_content_hash(record: dict) -> str:
    if record.get("content_hash"):
        return record["content_hash"]

    if record.get("turns"):
        payload = {
            "url": record.get("url") or "",
            "turns": [
                {
                    "id": turn.get("id") or "",
                    "selected_text": turn.get("selected_text") or "",
                    "followups": [
                        {"q": item.get("q") or "", "a": item.get("a") or ""}
                        for item in (turn.get("followups") or [])
                    ],
                }
                for turn in record["turns"]
            ],
        }
    else:
        payload = {
            "url": record.get("url") or "",
            "selected_text": record.get("selected_text") or "",
            "followups": [
                {"q": item.get("q") or "", "a": item.get("a") or ""}
                for item in (record.get("followups") or [])
            ],
        }

    digest = simple_hash(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return f"hash_{digest}"


def load_pipeline_state(output_dir: Path) -> dict:
    path = output_dir / STATE_FILENAME
    if not path.exists():
        return {"processed_ids": [], "processed_hashes": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"processed_ids": [], "processed_hashes": []}
    return {
        "processed_ids": list(data.get("processed_ids") or []),
        "processed_hashes": list(data.get("processed_hashes") or []),
    }


def save_pipeline_state(output_dir: Path, state: dict) -> None:
    path = output_dir / STATE_FILENAME
    path.write_text(
        json.dumps(
            {
                "processed_ids": sorted(set(state.get("processed_ids") or [])),
                "processed_hashes": sorted(set(state.get("processed_hashes") or [])),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def should_skip_record(record: dict, state: dict, force: bool) -> tuple[bool, str]:
    if force:
        return False, ""

    rec_id = (record.get("id") or "").strip()
    content_hash = compute_content_hash(record)

    if rec_id and rec_id in set(state.get("processed_ids") or []):
        return True, f"id={rec_id}"

    if content_hash in set(state.get("processed_hashes") or []):
        return True, f"content_hash={content_hash}"

    return False, ""


def mark_record_processed(state: dict, record: dict) -> None:
    rec_id = (record.get("id") or "").strip()
    content_hash = compute_content_hash(record)
    ids = set(state.get("processed_ids") or [])
    hashes = set(state.get("processed_hashes") or [])
    if rec_id:
        ids.add(rec_id)
    if content_hash:
        hashes.add(content_hash)
    state["processed_ids"] = list(ids)
    state["processed_hashes"] = list(hashes)


def render_front_matter(record: dict, created: datetime) -> str:
    tags = record.get("tags") or []
    marks = record.get("marks") or []
    content_hash = compute_content_hash(record)
    lines = [
        "---",
        f"source: {record.get('source', 'unknown')}",
        f"url: {record.get('url', '')}",
        f"type: {record.get('note_type', 'general')}",
        f"id: {record.get('id', '')}",
        f"content_hash: {content_hash}",
        f"created: {created.isoformat()}",
    ]
    if tags:
        lines.append("tags:")
        lines.extend(f"  - {t}" for t in tags)
    if marks:
        lines.append("marks:")
        lines.extend(f"  - {m}" for m in marks)
    lines.append("---")
    return "\n".join(lines)


def render_followups_section(followups: list[dict]) -> list[str]:
    parts = ["## 追问记录", ""]
    if followups:
        for item in followups:
            q = (item.get("q") or "").strip()
            a = (item.get("a") or "").strip()
            if q:
                parts.append(f"### {q}")
                parts.append("")
            if a:
                parts.append(a)
                parts.append("")
    else:
        parts.extend(["（暂无旁注追问）", ""])
    return parts


def render_selected_section(selected: str) -> list[str]:
    if not selected.strip():
        return []
    parts = ["## 选中的原文", ""]
    for line in selected.splitlines():
        parts.append(f"> {line}" if line else ">")
    parts.append("")
    return parts


def render_turn_section(turn: dict, index: int, tz_name: str) -> list[str]:
    created = parse_time(turn.get("time", ""), tz_name)
    stamp = created.strftime("%Y-%m-%d %H:%M")
    note_type = turn.get("note_type", "general")
    marks = turn.get("marks") or []
    selected = (turn.get("selected_text") or "").strip()

    parts = [f"## 便签 {index} · {stamp}", ""]

    if selected:
        parts.extend(render_selected_section(selected))

    parts.extend(render_followups_section(turn.get("followups") or []))

    meta = [f"- 类型：{NOTE_TYPE_LABELS.get(note_type, note_type)}"]
    if marks:
        mark_text = "、".join(MARK_LABELS.get(m, m) for m in marks)
        meta.append(f"- 标记：{mark_text}")
    if turn.get("tags"):
        meta.append(f"- 标签：{', '.join(turn['tags'])}")
    if turn.get("id"):
        meta.append(f"- 记录 id：{turn['id']}")

    parts.extend(["### 元数据", ""] + meta + [""])
    return parts


def render_markdown(record: dict, tz_name: str) -> str:
    created = parse_time(record.get("time", ""), tz_name)
    topic = (record.get("main_topic") or "未命名对话").strip()
    main_question = (record.get("main_question") or "").strip()
    selected = (record.get("selected_text") or "").strip()
    note_type = record.get("note_type", "general")
    marks = record.get("marks") or []
    followups = record.get("followups") or []
    turns = record.get("turns") or []

    parts = [
        render_front_matter(record, created),
        "",
        f"# {topic}",
        "",
    ]

    if main_question:
        parts.extend(["## 主问题", "", main_question, ""])

    if turns:
        for idx, turn in enumerate(turns, start=1):
            parts.extend(render_turn_section(turn, idx, tz_name))
    else:
        if selected:
            parts.extend(render_selected_section(selected))
        parts.extend(render_followups_section(followups))

    meta_lines = [
        f"- 类型：{NOTE_TYPE_LABELS.get(note_type, note_type)}",
        f"- 来源：{record.get('source', 'unknown')}",
    ]
    if marks:
        mark_text = "、".join(MARK_LABELS.get(m, m) for m in marks)
        meta_lines.append(f"- 标记：{mark_text}")
    if record.get("url"):
        meta_lines.append(f"- 对话链接：{record['url']}")
    if turns:
        meta_lines.append(f"- 便签数：{len(turns)}")

    parts.extend(["## 元数据", ""] + meta_lines + [""])

    if "todo" in marks or note_type == "todo":
        parts.extend(["## TODO", "", "- [ ] （在此补充待办）", ""])

    return "\n".join(parts).rstrip() + "\n"


def output_filename(record: dict, tz_name: str, *, suffix: str = "") -> str:
    created = parse_time(record.get("time", ""), tz_name)
    stamp = created.strftime("%Y%m%d-%H%M")
    topic = sanitize_filename(record.get("main_topic") or "未命名")
    rec_id = sanitize_filename(record.get("id", "").replace("rec_", ""), max_len=12)
    extra = f"-{suffix}" if suffix else ""
    return f"{stamp}-{topic}-{rec_id}{extra}.md"


def merge_key(record: dict) -> tuple[str, str]:
    topic = (record.get("main_topic") or "未命名对话").strip()
    url = (record.get("url") or "").strip()
    return topic, url


def group_records_for_merge(records: list[dict]) -> list[list[dict]]:
    groups: dict[tuple[str, str], list[dict]] = {}
    order: list[tuple[str, str]] = []
    for record in records:
        key = merge_key(record)
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(record)
    return [groups[key] for key in order]


def merge_records_into_one(records: list[dict]) -> dict:
    if len(records) == 1:
        return records[0]

    sorted_records = sorted(records, key=lambda r: r.get("time") or "")
    first = sorted_records[0]
    turns = []

    for record in sorted_records:
        if record.get("turns"):
            turns.extend(record["turns"])
        else:
            turns.append(
                {
                    "id": record.get("id") or "",
                    "time": record.get("time") or "",
                    "selected_text": record.get("selected_text") or "",
                    "followups": record.get("followups") or [],
                    "note_type": record.get("note_type") or "general",
                    "marks": record.get("marks") or [],
                    "tags": record.get("tags") or [],
                }
            )

    all_tags: list[str] = []
    for record in sorted_records:
        for tag in record.get("tags") or []:
            if tag not in all_tags:
                all_tags.append(tag)

    merged = {
        "schema_version": first.get("schema_version", 1),
        "id": first.get("id") or f"rec_merge_{sanitize_filename(first.get('main_topic', 'merge'), 12)}",
        "time": sorted_records[-1].get("time") or first.get("time") or "",
        "source": first.get("source") or "unknown",
        "url": first.get("url") or "",
        "main_topic": first.get("main_topic") or "",
        "main_question": first.get("main_question") or "",
        "selected_text": "",
        "followups": [],
        "note_type": first.get("note_type") or "general",
        "marks": [],
        "tags": all_tags,
        "status": "draft",
        "turns": turns,
    }
    merged["content_hash"] = compute_content_hash(merged)
    return merged


def resolve_output_dir(args: argparse.Namespace, config: dict) -> Path:
    if args.output:
        return Path(args.output).expanduser()
    vault = Path(config.get("vault_path", ".")).expanduser()
    inbox = config.get("inbox_dir", "00_Inbox")
    return vault / inbox


def file_conversion_stats(input_path: Path, output_dir: Path) -> dict:
    """统计 JSONL 行数与去重状态（不写入）。"""
    try:
        records = read_jsonl(input_path)
    except ValueError as exc:
        return {
            "line_count": 0,
            "skip_count": 0,
            "write_count": 0,
            "status": "error",
            "error": str(exc),
        }

    if not records:
        return {
            "line_count": 0,
            "skip_count": 0,
            "write_count": 0,
            "status": "empty",
            "error": "",
        }

    output_dir.mkdir(parents=True, exist_ok=True)
    state = load_pipeline_state(output_dir)
    skip_count = 0
    for record in records:
        skip, _ = should_skip_record(record, state, False)
        if skip:
            skip_count += 1

    line_count = len(records)
    write_count = line_count - skip_count
    if skip_count == 0:
        status = "new"
    elif skip_count >= line_count:
        status = "done"
    else:
        status = "partial"

    return {
        "line_count": line_count,
        "skip_count": skip_count,
        "write_count": write_count,
        "status": status,
        "error": "",
    }


def plan_conversion(
    input_path: Path,
    output_dir: Path,
    *,
    tz_name: str,
    merge_by: str | None,
    force: bool,
) -> dict:
    records = read_jsonl(input_path)
    if not records:
        raise ValueError(f"{input_path} 中没有有效记录。")

    if merge_by == "topic+url":
        work_records = [
            merge_records_into_one(group) for group in group_records_for_merge(records)
        ]
    else:
        work_records = records

    output_dir.mkdir(parents=True, exist_ok=True)
    state = load_pipeline_state(output_dir)

    planned: list[dict] = []
    for record in work_records:
        skip, reason = should_skip_record(record, state, force)
        filename = output_filename(record, tz_name)
        out_path = output_dir / filename
        planned.append(
            {
                "id": (record.get("id") or "").strip(),
                "content_hash": compute_content_hash(record),
                "main_topic": (record.get("main_topic") or "").strip() or "（无主题）",
                "url": (record.get("url") or "").strip(),
                "source": (record.get("source") or "").strip(),
                "note_type": (record.get("note_type") or "general").strip(),
                "selected_preview": ((record.get("selected_text") or "").strip()[:80]),
                "turn_count": len(record.get("turns") or []) or None,
                "out_path": str(out_path),
                "action": "skip" if skip else "write",
                "reason": reason,
            }
        )

    return {
        "total_records": len(records),
        "planned": planned,
        "merge_by": merge_by,
        "output_dir": str(output_dir),
    }


def convert_file(
    input_path: Path,
    output_dir: Path,
    *,
    tz_name: str,
    dry_run: bool,
    merge_by: str | None,
    force: bool,
) -> dict:
    records = read_jsonl(input_path)
    if not records:
        raise ValueError(f"{input_path} 中没有有效记录。")

    if merge_by == "topic+url":
        work_records = [merge_records_into_one(group) for group in group_records_for_merge(records)]
    else:
        work_records = records

    output_dir.mkdir(parents=True, exist_ok=True)
    state = load_pipeline_state(output_dir)
    written: list[Path] = []
    skipped: list[str] = []

    for record in work_records:
        skip, reason = should_skip_record(record, state, force)
        filename = output_filename(record, tz_name)
        out_path = output_dir / filename

        if skip:
            skipped.append(f"{filename} ({reason})")
            if dry_run:
                print(f"[dry-run][skip] {out_path} ({reason})")
            else:
                print(f"[skip] {out_path} ({reason})")
            continue

        if dry_run:
            print(f"[dry-run] {out_path}")
        else:
            content = render_markdown(record, tz_name)
            if out_path.exists() and not force:
                stem = out_path.stem
                out_path = output_dir / f"{stem}-dup.md"
            out_path.write_text(content, encoding="utf-8")
            mark_record_processed(state, record)
            print(f"写入 {out_path}")
        written.append(out_path)

    if not dry_run:
        save_pipeline_state(output_dir, state)

    return {"written": written, "skipped": skipped, "total": len(work_records)}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="JSONL → Obsidian Markdown")
    parser.add_argument("--input", "-i", required=True, help="输入 JSONL 文件路径")
    parser.add_argument("--output", "-o", help="输出目录（覆盖 config 中的 vault/inbox）")
    parser.add_argument("--config", "-c", help="config.yaml 路径")
    parser.add_argument(
        "--timezone",
        default=None,
        help="时区，如 Asia/Shanghai（默认读 config 或 UTC）",
    )
    parser.add_argument("--dry-run", action="store_true", help="只打印将写入的文件路径")
    parser.add_argument(
        "--merge-by",
        choices=["topic+url"],
        help="合并策略：同 main_topic + url 合成一篇 md",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="忽略 .pipeline-state.json 去重并允许覆盖",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    input_path = Path(args.input).expanduser()
    if not input_path.exists():
        print(f"错误：找不到输入文件 {input_path}", file=sys.stderr)
        return 1

    config_path = Path(args.config).expanduser() if args.config else Path(__file__).parent / "config.yaml"
    config = load_yaml_config(config_path) if config_path.exists() else load_yaml_config(
        Path(__file__).parent / "config.example.yaml"
    )

    tz_name = args.timezone or config.get("timezone") or "UTC"
    output_dir = resolve_output_dir(args, config)

    try:
        result = convert_file(
            input_path,
            output_dir,
            tz_name=tz_name,
            dry_run=args.dry_run,
            merge_by=args.merge_by,
            force=args.force,
        )
    except ValueError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1

    action = "将生成" if args.dry_run else "已生成"
    print(
        f"{action} {len(result['written'])} 个 Markdown 文件，"
        f"跳过 {len(result['skipped'])} 条 → {output_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
