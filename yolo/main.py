
1"""
Word Hunt photo checker.

POST /detect  (multipart: image=<jpeg>, label=<class name>)
  -> { "detected": bool, "confidence": float | null, "labels": [{ "label", "confidence" }] }

`detected` is true when the target class appears at or above MIN_CONFIDENCE. The Express server
applies its own YOLO_MIN_CONFIDENCE on top, so keep this one at or below that.

Env:
  YOLO_MODEL       weights file or Ultralytics model name (default yolo11n.pt, downloaded on first run)
  YOLO_KEY         shared secret; requests must send X-Yolo-Key with this value (empty = no check)
  MIN_CONFIDENCE   lowest score reported as a detection (default 0.25)
"""

import io
import os
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps
from ultralytics import YOLO

MODEL_NAME = os.environ.get("YOLO_MODEL", "yolo11n.pt")
YOLO_KEY = os.environ.get("YOLO_KEY", "")
MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.25"))
MAX_BYTES = 8 * 1024 * 1024

model: YOLO | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global model
    model = YOLO(MODEL_NAME)
    yield


app = FastAPI(title="Word Hunt YOLO", lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": model is not None, "model": MODEL_NAME, "classes": len(model.names) if model else 0}


@app.get("/classes")
def classes():
    """Every label the model knows. Each daily word must be one of these."""
    if model is None:
        raise HTTPException(503, "model not loaded")
    return sorted(model.names.values())


@app.post("/detect")
async def detect(
    image: UploadFile = File(...),
    label: str = Form(...),
    x_yolo_key: str | None = Header(default=None),
):
    if YOLO_KEY and not secrets.compare_digest(x_yolo_key or "", YOLO_KEY):
        raise HTTPException(401, "bad key")
    if model is None:
        raise HTTPException(503, "model not loaded")

    data = await image.read(MAX_BYTES + 1)
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
