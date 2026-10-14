#!/usr/bin/env python3
"""Serve Light Pathfinder locally for offline play; uses only Python's stdlib."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, webbrowser
ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
PORT = int(os.environ.get("PORT", "8000"))
url = f"http://127.0.0.1:{PORT}/"
print(f"Light Pathfinder HTML5 is available at {url}\nPress Ctrl+C to stop.")
try:
    webbrowser.open(url)
except Exception:
    pass
ThreadingHTTPServer(("127.0.0.1", PORT), SimpleHTTPRequestHandler).serve_forever()
