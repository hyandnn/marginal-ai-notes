#!/usr/bin/env python3
"""
Local Note Pipeline（极简 GUI）：
- 选择 JSONL（支持多选批量）
- 预览将生成哪些 md（含 topic / url）
- 执行转换（merge/force）
- 可选监视 Record 目录

启动：
  pip install -r requirements-pipeline.txt
  python3 pipeline_app.py
然后打开 http://127.0.0.1:5179
"""

from __future__ import annotations

import platform
import subprocess
import threading
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse

from jsonl_to_md import (
    convert_file,
    file_conversion_stats,
    list_record_jsonl_paths,
    load_yaml_config,
    plan_conversion,
    resolve_output_dir,
)

APP_PORT = 5179
WATCH_INTERVAL_SEC = 2.0

app = FastAPI(title="Local Note Pipeline", version="0.3.0")


def load_config() -> dict:
    config_path = Path(__file__).parent / "config.yaml"
    if config_path.exists():
        return load_yaml_config(config_path)
    return load_yaml_config(Path(__file__).parent / "config.example.yaml")


def get_record_dir(cfg: dict) -> Path:
    raw = cfg.get("record_dir") or cfg.get("record_path") or "~/Downloads/Record"
    return Path(raw).expanduser()


def get_default_output_dir(cfg: dict) -> Path:
    return resolve_output_dir(type("Args", (), {"output": None})(), cfg)


def list_jsonl_paths(record_dir: Path) -> set[Path]:
    return list_record_jsonl_paths(record_dir)


def open_in_file_manager(path: Path) -> None:
    target = path.expanduser()
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"路径不存在：{target}")

    system = platform.system()
    if system == "Darwin":
        subprocess.run(["open", str(target)], check=False)
    elif system == "Windows":
        subprocess.run(["explorer", str(target)], check=False)
    else:
        subprocess.run(["xdg-open", str(target)], check=False)


def list_jsonl_files(record_dir: Path, output_dir: Path) -> list[dict]:
    items = []
    for p in sorted(list_jsonl_paths(record_dir), key=lambda x: x.stat().st_mtime, reverse=True):
        stats = file_conversion_stats(p, output_dir)
        items.append(
            {
                "name": p.name,
                "path": str(p),
                "mtime_ms": int(p.stat().st_mtime * 1000),
                "size": p.stat().st_size,
                "line_count": stats["line_count"],
                "skip_count": stats["skip_count"],
                "write_count": stats["write_count"],
                "status": stats["status"],
                "status_error": stats.get("error") or "",
            }
        )
    return items


class RecordWatcher:
    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self.running = False
        self.merge_by: str | None = None
        self.force = False
        self.output_dir: str | None = None
        self.processed: list[str] = []
        self.errors: list[str] = []
        self.last_scan_ms: int | None = None

    def status(self) -> dict:
        return {
            "running": self.running,
            "merge_by": self.merge_by,
            "force": self.force,
            "output_dir": self.output_dir,
            "processed_count": len(self.processed),
            "processed_recent": self.processed[-5:],
            "errors_recent": self.errors[-3:],
            "last_scan_ms": self.last_scan_ms,
        }

    def start(self, *, merge_by: str | None, force: bool, output_dir: str | None) -> None:
        if self.running:
            return
        self.merge_by = merge_by
        self.force = force
        self.output_dir = output_dir
        self.processed.clear()
        self.errors.clear()
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self.running = True
        self._thread.start()

    def stop(self) -> None:
        if not self.running:
            return
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        self.running = False

    def _run(self) -> None:
        cfg = load_config()
        tz_name = cfg.get("timezone") or "UTC"
        record_dir = get_record_dir(cfg)
        out_dir = (
            Path(self.output_dir).expanduser()
            if self.output_dir
            else get_default_output_dir(cfg)
        )
        seen = list_jsonl_paths(record_dir)

        while not self._stop.is_set():
            self.last_scan_ms = int(time.time() * 1000)
            current = list_jsonl_paths(record_dir)
            for path in sorted(current - seen):
                try:
                    convert_file(
                        path,
                        out_dir,
                        tz_name=tz_name,
                        dry_run=False,
                        merge_by=self.merge_by,
                        force=self.force,
                    )
                    self.processed.append(path.name)
                except ValueError as exc:
                    self.errors.append(f"{path.name}: {exc}")
            seen = current
            self._stop.wait(WATCH_INTERVAL_SEC)

        self.running = False


watcher = RecordWatcher()


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
        "port": APP_PORT,
    }


@app.get("/api/files")
def api_files(output_dir: str | None = None) -> dict:
    cfg = load_config()
    record_dir = get_record_dir(cfg)
    out_dir = Path(output_dir).expanduser() if output_dir else get_default_output_dir(cfg)
    return {
        "record_dir": str(record_dir),
        "output_dir": str(out_dir),
        "files": list_jsonl_files(record_dir, out_dir),
    }


@app.post("/api/open-path")
async def api_open_path(payload: dict) -> JSONResponse:
    raw = payload.get("path")
    if not raw:
        raise HTTPException(status_code=400, detail="缺少 path。")
    open_in_file_manager(Path(raw))
    return JSONResponse({"ok": True, "path": str(Path(raw).expanduser())})


def _preview_one(
    file: str,
    merge_by: str | None,
    force: bool,
    output_dir: str | None,
) -> dict:
    cfg = load_config()
    tz_name = cfg.get("timezone") or "UTC"
    record_path = Path(file).expanduser()
    if not record_path.exists():
        raise HTTPException(status_code=404, detail="找不到该 JSONL 文件。")
    out_dir = Path(output_dir).expanduser() if output_dir else get_default_output_dir(cfg)
    try:
        result = plan_conversion(
            record_path,
            out_dir,
            tz_name=tz_name,
            merge_by=merge_by,
            force=force,
        )
        result["file"] = str(record_path)
        result["filename"] = record_path.name
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/preview")
def api_preview(
    file: str,
    merge_by: str | None = None,
    force: bool = False,
    output_dir: str | None = None,
) -> dict:
    return _preview_one(file, merge_by, force, output_dir)


@app.post("/api/preview-batch")
async def api_preview_batch(payload: dict) -> JSONResponse:
    files = payload.get("files") or []
    if not files:
        raise HTTPException(status_code=400, detail="请选择至少一个文件。")

    merge_by = payload.get("merge_by") or None
    force = bool(payload.get("force") or False)
    output_dir = payload.get("output_dir") or None

    previews = []
    total_write = 0
    total_skip = 0
    for file in files:
        try:
            result = _preview_one(file, merge_by, force, output_dir)
            planned = result.get("planned") or []
            total_write += sum(1 for p in planned if p["action"] == "write")
            total_skip += sum(1 for p in planned if p["action"] == "skip")
            previews.append(result)
        except HTTPException as exc:
            previews.append({"file": file, "error": exc.detail})

    return JSONResponse(
        {
            "previews": previews,
            "file_count": len(files),
            "total_write": total_write,
            "total_skip": total_skip,
        }
    )


@app.post("/api/convert")
async def api_convert(payload: dict) -> JSONResponse:
    files = payload.get("files") or []
    if not files and payload.get("file"):
        files = [payload["file"]]
    if not files:
        raise HTTPException(status_code=400, detail="缺少 file / files。")

    merge_by = payload.get("merge_by") or None
    force = bool(payload.get("force") or False)
    output_dir = payload.get("output_dir") or None

    cfg = load_config()
    tz_name = cfg.get("timezone") or "UTC"
    out_dir = Path(output_dir).expanduser() if output_dir else get_default_output_dir(cfg)

    written_all: list[str] = []
    skipped_all: list[str] = []
    errors: list[str] = []

    for file in files:
        record_path = Path(file).expanduser()
        if not record_path.exists():
            errors.append(f"{file}: 文件不存在")
            continue
        try:
            result = convert_file(
                record_path,
                out_dir,
                tz_name=tz_name,
                dry_run=False,
                merge_by=merge_by,
                force=force,
            )
            written_all.extend(str(p) for p in result["written"])
            skipped_all.extend(result["skipped"])
        except ValueError as exc:
            errors.append(f"{record_path.name}: {exc}")

    return JSONResponse(
        {
            "ok": True,
            "written": written_all,
            "skipped": skipped_all,
            "errors": errors,
            "file_count": len(files),
            "output_dir": str(out_dir),
        }
    )


@app.get("/api/watch/status")
def api_watch_status() -> dict:
    return watcher.status()


@app.post("/api/watch/start")
async def api_watch_start(payload: dict) -> JSONResponse:
    merge_by = payload.get("merge_by") or None
    force = bool(payload.get("force") or False)
    output_dir = payload.get("output_dir") or None
    watcher.start(merge_by=merge_by, force=force, output_dir=output_dir)
    return JSONResponse({"ok": True, **watcher.status()})


@app.post("/api/watch/stop")
async def api_watch_stop() -> JSONResponse:
    watcher.stop()
    return JSONResponse({"ok": True, **watcher.status()})


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
