"""
Word Hunt photo checker: `uv run uvicorn main:app --port 8001`.

POST /detect  (multipart: image=<jpeg>, label=<class name>)
  -> { "detected": bool, "confidence": float | null, "labels": [{ "label", "confidence" }] }

`detected` is true when the target class appears at or above MIN_CONFIDENCE. The Express server
applies its own threshold on top (YOLO_MIN_CONFIDENCE, or a per-word override), so keep this one at
or below that.

One shared model answers for every game word. The word to look for comes with each request, so
there is nothing to swap when the day changes. A new model version is a normal restart with a new
YOLO_MODEL / MODEL_VERSION.

Env:
  YOLO_MODEL       weights file (relative to yolo/) or Ultralytics model name (default yolo11s.pt,
                   downloaded on first run)
  MODEL_VERSION    name shown in /health and the admin panel (default: from the weights path)
  YOLO_KEY         shared secret; requests must send X-Yolo-Key with this value (empty = no check)
  MIN_CONFIDENCE   lowest score reported as a detection (default 0.25)
  EVAL_REPORT      word-test report served at /eval/report (default eval/latest.json)

The code lives in wordhunt_yolo/ (api.py has the endpoints).
"""

from wordhunt_yolo.api import create_app
from wordhunt_yolo.config import load_settings

app = create_app(load_settings())
