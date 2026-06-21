#!/usr/bin/env python3
"""jsonl_to_md.py 单元测试。"""

import json
import tempfile
import unittest
from pathlib import Path

from jsonl_to_md import (
    compute_content_hash,
    convert_file,
    load_pipeline_state,
    merge_records_into_one,
    read_jsonl,
    render_markdown,
    sanitize_filename,
    output_filename,
    should_skip_record,
)

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "sample.jsonl"
MERGED = FIXTURES / "merged.jsonl"


class JsonlToMdTest(unittest.TestCase):
    def test_read_jsonl_one_line_per_record(self):
        records = read_jsonl(SAMPLE)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["main_topic"], "地面分割算法")
        self.assertEqual(len(records[0]["followups"]), 2)

    def test_sanitize_filename(self):
        self.assertEqual(sanitize_filename('a/b:c*d?'), "a_b_c_d")

    def test_render_markdown_contains_sections(self):
        record = read_jsonl(SAMPLE)[0]
        md = render_markdown(record, "Asia/Shanghai")
        self.assertIn("# 地面分割算法", md)
        self.assertIn("## 主问题", md)
        self.assertIn("## 选中的原文", md)
        self.assertIn("## 追问记录", md)
        self.assertIn("### v-disparity 是什么？", md)
        self.assertIn("source: chatgpt", md)
        self.assertIn("  - stereo", md)
        self.assertIn("- 标记：重要", md)
        self.assertIn("content_hash:", md)

    def test_output_filename_format(self):
        record = read_jsonl(SAMPLE)[0]
        name = output_filename(record, "Asia/Shanghai")
        self.assertRegex(name, r"^\d{8}-\d{4}-.+-.+\.md$")

    def test_content_hash_stable(self):
        record = read_jsonl(SAMPLE)[0]
        record["content_hash"] = compute_content_hash(record)
        h1 = compute_content_hash(record)
        h2 = compute_content_hash({**record, "content_hash": None})
        self.assertEqual(h1, h2)

    def test_render_merged_turns(self):
        record = read_jsonl(MERGED)[0]
        md = render_markdown(record, "Asia/Shanghai")
        self.assertIn("## 便签 1", md)
        self.assertIn("## 便签 2", md)
        self.assertIn("- 便签数：2", md)

    def test_merge_records_into_one(self):
        records = read_jsonl(SAMPLE) + read_jsonl(SAMPLE)
        records[1]["id"] = "rec_note_test_002"
        records[1]["selected_text"] = "另一段选中文本"
        merged = merge_records_into_one(records)
        self.assertEqual(len(merged["turns"]), 2)

    def test_dedup_skips_processed_id(self):
        record = read_jsonl(SAMPLE)[0]
        state = {"processed_ids": [record["id"]], "processed_hashes": []}
        skip, reason = should_skip_record(record, state, force=False)
        self.assertTrue(skip)
        self.assertIn(record["id"], reason)

    def test_convert_file_respects_dedup(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            result = convert_file(
                SAMPLE,
                out_dir,
                tz_name="Asia/Shanghai",
                dry_run=False,
                merge_by=None,
                force=False,
            )
            self.assertEqual(len(result["written"]), 1)
            state = load_pipeline_state(out_dir)
            self.assertIn(read_jsonl(SAMPLE)[0]["id"], state["processed_ids"])

            second = convert_file(
                SAMPLE,
                out_dir,
                tz_name="Asia/Shanghai",
                dry_run=False,
                merge_by=None,
                force=False,
            )
            self.assertEqual(len(second["written"]), 0)
            self.assertEqual(len(second["skipped"]), 1)


if __name__ == "__main__":
    unittest.main()
