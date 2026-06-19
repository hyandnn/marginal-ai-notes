#!/usr/bin/env python3
"""
将 Agent Sidenote 导出的 JSONL 转为 Obsidian Markdown。

用法：
  python jsonl_to_md.py --input notes.jsonl --output ~/ObsidianVault/00_Inbox/
  python jsonl_to_md.py --input notes.jsonl --config config.yaml --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

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


def render_front_matter(record: dict, created: datetime) -> str:
    tags = record.get("tags") or []
    marks = record.get("marks") or []
    lines = [
        "---",
        f"source: {record.get('source', 'unknown')}",
        f"url: {record.get('url', '')}",
        f"type: {record.get('note_type', 'general')}",
        f"id: {record.get('id', '')}",
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


def render_markdown(record: dict, tz_name: str) -> str:
    created = parse_time(record.get("time", ""), tz_name)
    topic = (record.get("main_topic") or "未命名对话").strip()
    main_question = (record.get("main_question") or "").strip()
    selected = (record.get("selected_text") or "").strip()
    note_type = record.get("note_type", "general")
    marks = record.get("marks") or []
    followups = record.get("followups") or []

    parts = [
        render_front_matter(record, created),
        "",
        f"# {topic}",
        "",
    ]

    if main_question:
        parts.extend(["## 主问题", "", main_question, ""])

    if selected:
        parts.extend(["## 选中的原文", ""])
        for line in selected.splitlines():
            parts.append(f"> {line}" if line else ">")
        parts.append("")

    parts.extend(["## 追问记录", ""])
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

    meta_lines = [
        f"- 类型：{NOTE_TYPE_LABELS.get(note_type, note_type)}",
        f"- 来源：{record.get('source', 'unknown')}",
    ]
    if marks:
        mark_text = "、".join(MARK_LABELS.get(m, m) for m in marks)
        meta_lines.append(f"- 标记：{mark_text}")
    if record.get("url"):
        meta_lines.append(f"- 对话链接：{record['url']}")

    parts.extend(["## 元数据", ""] + meta_lines + [""])

    if "todo" in marks or note_type == "todo":
        parts.extend(["## TODO", "", "- [ ] （在此补充待办）", ""])

    return "\n".join(parts).rstrip() + "\n"


def output_filename(record: dict, tz_name: str) -> str:
    created = parse_time(record.get("time", ""), tz_name)
    stamp = created.strftime("%Y%m%d-%H%M")
    topic = sanitize_filename(record.get("main_topic") or "未命名")
    rec_id = sanitize_filename(record.get("id", "").replace("rec_", ""), max_len=12)
    return f"{stamp}-{topic}-{rec_id}.md"


def resolve_output_dir(args: argparse.Namespace, config: dict) -> Path:
    if args.output:
        return Path(args.output).expanduser()
    vault = Path(config.get("vault_path", ".")).expanduser()
    inbox = config.get("inbox_dir", "00_Inbox")
    return vault / inbox


def convert_file(
    input_path: Path,
    output_dir: Path,
    *,
    tz_name: str,
    dry_run: bool,
) -> list[Path]:
    records = read_jsonl(input_path)
    if not records:
        raise ValueError(f"{input_path} 中没有有效记录。")

    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    for record in records:
        filename = output_filename(record, tz_name)
        out_path = output_dir / filename
        content = render_markdown(record, tz_name)

        if dry_run:
            print(f"[dry-run] {out_path}")
        else:
            out_path.write_text(content, encoding="utf-8")
            print(f"写入 {out_path}")
        written.append(out_path)

    return written


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
        written = convert_file(
            input_path,
            output_dir,
            tz_name=tz_name,
            dry_run=args.dry_run,
        )
    except ValueError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1

    action = "将生成" if args.dry_run else "已生成"
    print(f"{action} {len(written)} 个 Markdown 文件 → {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
