"""
Word Hunt photo checker.

POST /detect  (multipart: image=<jpeg>, label=<class name>)
  -> { "detected": bool, "confidence": float | null, "labels": [{ "label", "confidence" }] }

`detected` is true when the target class appears at or above MIN_CONFIDENCE. The Express server
applies its own threshold on top (YOLO_MIN_CONFIDENCE, or a per-word override), so keep this one at
or below that.

One shared model answers for every game word. The word to look for comes with each request, so
there is nothing to swap when the day changes. A new model version is a normal restart with a new
YOLO_MODEL / MODEL_VERSION.

Env:
  YOLO_MODEL       weights file or Ultralytics model name (default yolo11s.pt, downloaded on first run)
  MODEL_VERSION    name shown in /health and the admin panel (default: the weights file name)
  YOLO_KEY         shared secret; requests must send X-Yolo-Key with this value (empty = no check)
  MIN_CONFIDENCE   lowest score reported as a detection (default 0.25)
  EVAL_REPORT      word-test report served at /eval/report (default eval/latest.json)
"""

import io
import json
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps
from ultralytics import YOLO

HERE = Path(__file__).resolve().parent
MODEL_NAME = os.environ.get("YOLO_MODEL", "yolo11s.pt")
MODEL_VERSION = os.environ.get("MODEL_VERSION") or Path(MODEL_NAME).stem
YOLO_KEY = os.environ.get("YOLO_KEY", "")
MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.25"))
EVAL_REPORT = Path(os.environ.get("EVAL_REPORT", HERE / "eval" / "latest.json"))
MAX_BYTES = 8 * 1024 * 1024

model: YOLO | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global model
    model = YOLO(MODEL_NAME)
    yield


app = FastAPI(title="Word Hunt YOLO", lifespan=lifespan)


def check_key(x_yolo_key: str | None) -> None:
    if YOLO_KEY and not secrets.compare_digest(x_yolo_key or "", YOLO_KEY):
        raise HTTPException(401, "bad key")


@app.get("/health")
def health():
    return {
        "ok": model is not None,
        "model": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
        "classes": len(model.names) if model else 0,
    }


@app.get("/classes")
def classes():
    """Every label the model knows. Each daily word must be one of these."""
    if model is None:
        raise HTTPException(503, "model not loaded")
    return sorted(model.names.values())


@app.get("/eval/report")
def eval_report(x_yolo_key: str | None = Header(default=None)):
    """The latest word-test report written by eval/evaluate.py."""
    check_key(x_yolo_key)
    if not EVAL_REPORT.is_file():
        raise HTTPException(404, "no word-test report yet")
    return json.loads(EVAL_REPORT.read_text(encoding="utf-8"))


# A plain `def`: FastAPI runs it in its thread pool, so a slow photo doesn't block other requests.
@app.post("/detect")
def detect(
    image: UploadFile = File(...),
    label: str = Form(...),
    x_yolo_key: str | None = Header(default=None),
):
    check_key(x_yolo_key)
    if model is None:
        raise HTTPException(503, "model not loaded")

    data = image.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "image too large")
    try:
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    except Exception:
        raise HTTPException(400, "not an image")

    target = label.strip().lower()
    if target not in {n.lower() for n in model.names.values()}:
        raise HTTPException(400, f"unknown label: {label}")

    result = model.predict(img, conf=MIN_CONFIDENCE, verbose=False)[0]
    found = [
        {"label": model.names[int(cls)], "confidence": round(float(conf), 4)}
        for cls, conf in zip(result.boxes.cls.tolist(), result.boxes.conf.tolist())
    ]
    best = max((f["confidence"] for f in found if f["label"].lower() == target), default=None)
    return {"detected": best is not None, "confidence": best, "labels": found}
