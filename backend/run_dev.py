#!/usr/bin/env python
"""
Development server entry point.

Use this instead of bare `python -m uvicorn app.main:app --reload`.

The critical difference: reload_dirs=["app"] restricts Uvicorn's file watcher
to the Python source tree only. Without this restriction, Uvicorn watches the
entire backend/ directory, which includes cmf.db, cmf.db-wal, uploads/, and
logs/. Every database write (i.e. every import) triggers a server reload,
dropping all in-flight requests and WebSocket connections.

Usage:
    python run_dev.py
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app"],   # ← Only watch Python source, NOT cmf.db / uploads / logs
        log_level="info",
    )
