#!/usr/bin/env python3
"""jsonl_to_md.py 单元测试。"""

import unittest
from pathlib import Path

from jsonl_to_md import read_jsonl, render_markdown, sanitize_filename, output_filename

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE = FIXTURES / "sample.jsonl"


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

    def test_output_filename_format(self):
        record = read_jsonl(SAMPLE)[0]
        name = output_filename(record, "Asia/Shanghai")
        self.assertRegex(name, r"^\d{8}-\d{4}-.+-.+\.md$")


if __name__ == "__main__":
    unittest.main()
