"""
HTTP API of the photo checker. The Express server's client is server/src/services/yolo-http.ts.

  GET  /health        { ok, model, modelVersion, classes }
  GET  /classes       every label the model knows
  POST /detect        multipart image=<jpeg>, label=<class name>, header X-Yolo-Key
                      -> { detected, confidence, labels: [{ label, confidence }] }
  GET  /eval/report   latest word-test report (yolo/eval), header X-Yolo-Key
"""

import json
import secrets
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from pydantic import BaseModel

from .common import weights_ref
from .config import Settings
from .detector import Detector, YoloDetector
from .imaging import ImageTooLarge, NotAnImage, decode_image
from .inference import normalize, verdict


class Health(BaseModel):
    ok: bool
    model: str
    modelVersion: str
    classes: int


class Label(BaseModel):
    label: str
    confidence: float


class DetectResult(BaseModel):
    #: The target appears at or above the service's MIN_CONFIDENCE.
    detected: bool
    confidence: float | None
    #: Everything the model saw, for debugging.
    labels: list[Label]


def create_app(settings: Settings, detector: Detector | None = None) -> FastAPI:
    """The service. Pass `detector` to skip loading a real model (tests)."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.detector = detector or YoloDetector(weights_ref(settings.model))
        app.state.known = {normalize(n) for n in app.state.detector.names}
        yield

    app = FastAPI(title="Eyes Peeled YOLO", lifespan=lifespan)
    app.state.settings = settings

    def require_key(x_yolo_key: Annotated[str | None, Header()] = None) -> None:
        if settings.key and not secrets.compare_digest(x_yolo_key or "", settings.key):
            raise HTTPException(401, "bad key")

    def loaded(request: Request) -> Detector:
        model = getattr(request.app.state, "detector", None)
        if model is None:
            raise HTTPException(503, "model not loaded")
        return model

    @app.get("/health")
    def health(request: Request) -> Health:
        model = getattr(request.app.state, "detector", None)
        return Health(
            ok=model is not None,
            model=settings.model,
            modelVersion=settings.model_version,
            classes=len(model.names) if model else 0,
        )

    @app.get("/classes")
    def classes(model: Annotated[Detector, Depends(loaded)]) -> list[str]:
        """Every label the model knows. Each daily word must be one of these."""
        return sorted(model.names)

    @app.get("/eval/report", dependencies=[Depends(require_key)])
    def eval_report() -> dict:
        """The latest word-test report written by eval/evaluate.py."""
        if not settings.eval_report.is_file():
            raise HTTPException(404, "no word-test report yet")
        try:
            return json.loads(settings.eval_report.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise HTTPException(500, f"word-test report is not valid JSON: {e}") from e

    # A plain `def`: FastAPI runs it in its thread pool, so a slow photo doesn't block other requests.
    @app.post("/detect", dependencies=[Depends(require_key)])
    def detect(
        request: Request,
        model: Annotated[Detector, Depends(loaded)],
        image: Annotated[UploadFile, File()],
        label: Annotated[str, Form()],
    ) -> DetectResult:
        try:
            img = decode_image(image.file.read(settings.max_image_bytes + 1), settings.max_image_bytes)
        except ImageTooLarge:
            raise HTTPException(413, "image too large") from None
        except NotAnImage:
            raise HTTPException(400, "not an image") from None

        if normalize(label) not in request.app.state.known:
            raise HTTPException(400, f"unknown label: {label}")

        found = model.detect(img, settings.min_confidence)
        v = verdict(found, label)
        return DetectResult(
            detected=v.detected,
            confidence=v.confidence,
            labels=[Label(label=d.label, confidence=d.confidence) for d in found],
        )

    return app
