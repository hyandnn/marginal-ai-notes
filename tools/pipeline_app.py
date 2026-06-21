#!/usr/bin/env python3
"""
Local Note Pipeline（极简 GUI）：
- 选择 JSONL
- 预览将生成哪些 md（含去重 skip）
- 执行转换（merge/force）

启动：
  pip install -r requirements-pipeline.txt
  python3 pipeline_app.py
然后打开 http://127.0.0.1:5179
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse

from jsonl_to_md import convert_file, load_yaml_config, plan_conversion, resolve_output_dir

APP_PORT = 5179

app = FastAPI(title="Local Note Pipeline", version="0.1.0")


def load_config() -> dict:
    config_path = Path(__file__).parent / "config.yaml"
    if config_path.exists():
        return load_yaml_config(config_path)
    return load_yaml_config(Path(__file__).parent / "config.example.yaml")


def get_record_dir(cfg: dict) -> Path:
    # 兼容历史 key：record_path / record_dir
    raw = cfg.get("record_dir") or cfg.get("record_path") or "~/Downloads/Record"
    return Path(raw).expanduser()


def get_default_output_dir(cfg: dict) -> Path:
    return resolve_output_dir(type("Args", (), {"output": None})(), cfg)  # lightweight shim


JSONL_GLOBS = ("*.jsonl", "*.ndjson")


def list_jsonl_files(record_dir: Path) -> list[dict]:
    if not record_dir.exists():
        return []
    items = []
    paths: list[Path] = []
    for pattern in JSONL_GLOBS:
        paths.extend(record_dir.glob(pattern))
    for p in sorted(set(paths), key=lambda x: x.stat().st_mtime, reverse=True):
        items.append(
            {
                "name": p.name,
                "path": str(p),
                "mtime_ms": int(p.stat().st_mtime * 1000),
                "size": p.stat().st_size,
            }
        )
    return items


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return (Path(__file__).parent / "pipeline_ui.html").read_text(encoding="utf-8")


@app.get("/api/config")
def api_config() -> dict:
    cfg = load_config()
    record_dir = get_record_dir(cfg)
    out_dir = get_default_output_dir(cfg)
    return {
        "record_dir": str(record_dir),
        "default_output_dir": str(out_dir),
        "timezone": cfg.get("timezone") or "UTC",
    }


@app.get("/api/files")
def api_files() -> dict:
    cfg = load_config()
    record_dir = get_record_dir(cfg)
    return {"record_dir": str(record_dir), "files": list_jsonl_files(record_dir)}


@app.get("/api/preview")
def api_preview(
    file: str,
    merge_by: str | None = None,
    force: bool = False,
    output_dir: str | None = None,
) -> dict:
    cfg = load_config()
    tz_name = cfg.get("timezone") or "UTC"

    record_path = Path(file).expanduser()
    if not record_path.exists():
        raise HTTPException(status_code=404, detail="找不到该 JSONL 文件。")

    out_dir = Path(output_dir).expanduser() if output_dir else get_default_output_dir(cfg)

    try:
        return plan_conversion(
            record_path,
            out_dir,
            tz_name=tz_name,
            merge_by=merge_by,
            force=force,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/convert")
async def api_convert(payload: dict) -> JSONResponse:
    cfg = load_config()
    tz_name = cfg.get("timezone") or "UTC"

    file = payload.get("file")
    if not file:
        raise HTTPException(status_code=400, detail="缺少 file。")

    merge_by = payload.get("merge_by") or None
    force = bool(payload.get("force") or False)
    output_dir = payload.get("output_dir") or None

    record_path = Path(file).expanduser()
    if not record_path.exists():
        raise HTTPException(status_code=404, detail="找不到该 JSONL 文件。")

    out_dir = Path(output_dir).expanduser() if output_dir else get_default_output_dir(cfg)

    try:
        result = convert_file(
            record_path,
            out_dir,
            tz_name=tz_name,
            dry_run=False,
            merge_by=merge_by,
            force=force,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return JSONResponse(
        {
            "ok": True,
            "written": [str(p) for p in result["written"]],
            "skipped": result["skipped"],
            "total": result["total"],
            "output_dir": str(out_dir),
        }
    )


def main() -> int:
    try:
        import uvicorn
    except ImportError:
        print("缺少依赖：请先 pip install -r requirements-pipeline.txt")
        return 1

    uvicorn.run(app, host="127.0.0.1", port=APP_PORT, log_level="info")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

