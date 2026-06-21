#!/usr/bin/env python3
"""
监视 Record 目录，新 JSONL 自动转为 Markdown。

用法：
  python watch_jsonl.py
  python watch_jsonl.py --record-dir ~/Downloads/Record --dry-run
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from jsonl_to_md import convert_file, load_yaml_config, resolve_output_dir


def list_jsonl_files(record_dir: Path) -> set[Path]:
    if not record_dir.exists():
        return set()
    files: set[Path] = set()
    for pattern in ("*.jsonl", "*.ndjson"):
        files.update(p.resolve() for p in record_dir.glob(pattern) if p.is_file())
    return files


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="监视 JSONL 并自动转换")
    parser.add_argument(
        "--record-dir",
        help="JSONL 目录（默认读 config record_dir 或 ~/Downloads/Record）",
    )
    parser.add_argument("--output", "-o", help="Markdown 输出目录")
    parser.add_argument("--config", "-c", help="config.yaml 路径")
    parser.add_argument("--interval", type=float, default=2.0, help="轮询间隔秒数")
    parser.add_argument("--dry-run", action="store_true", help="转换时使用 dry-run")
    parser.add_argument("--force", action="store_true", help="忽略去重状态")
    parser.add_argument(
        "--merge-by",
        choices=["topic+url"],
        help="合并策略：同 main_topic + url",
    )
    parser.add_argument("--once", action="store_true", help="处理现有文件后退出，不持续监视")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    config_path = Path(args.config).expanduser() if args.config else Path(__file__).parent / "config.yaml"
    config = load_yaml_config(config_path) if config_path.exists() else load_yaml_config(
        Path(__file__).parent / "config.example.yaml"
    )

    record_dir = Path(
        args.record_dir or config.get("record_dir") or config.get("record_path") or "~/Downloads/Record"
    ).expanduser()
    output_dir = resolve_output_dir(argparse.Namespace(output=args.output), config)
    tz_name = config.get("timezone") or "UTC"

    if not record_dir.exists():
        print(f"错误：Record 目录不存在 {record_dir}", file=sys.stderr)
        return 1

    seen = list_jsonl_files(record_dir)
    print(f"监视 {record_dir} → {output_dir}（间隔 {args.interval}s）")

    def process_files(paths: list[Path]) -> None:
        for path in paths:
            print(f"\n处理 {path.name}")
            try:
                convert_file(
                    path,
                    output_dir,
                    tz_name=tz_name,
                    dry_run=args.dry_run,
                    merge_by=args.merge_by,
                    force=args.force,
                )
            except ValueError as exc:
                print(f"跳过 {path.name}：{exc}", file=sys.stderr)

    if args.once:
        process_files(sorted(seen))
        return 0

    def process_new_files(current: set[Path]) -> None:
        new_files = sorted(current - seen)
        if new_files:
            process_files(new_files)
        seen.update(new_files)

    try:
        while True:
            current = list_jsonl_files(record_dir)
            process_new_files(current)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n已停止监视。")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
