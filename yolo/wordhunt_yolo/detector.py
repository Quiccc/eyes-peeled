"""The model behind the service: what it knows and what it sees in a photo."""

import threading
from dataclasses import dataclass
from typing import Protocol

from PIL import Image


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float


class Detector(Protocol):
    """What the API needs from a model. The real one wraps Ultralytics; tests pass a fake."""

    #: Every label the model knows, in class-id order.
    names: list[str]

    def detect(self, img: Image.Image, min_confidence: float) -> list[Detection]: ...


class YoloDetector:
    """An Ultralytics YOLO model.

    /detect runs in FastAPI's thread pool, but an Ultralytics model isn't safe to call from several
    threads at once (the predictor keeps per-call state). Calls take turns on a lock; the model is
    the bottleneck either way.
    """

    def __init__(self, weights: str):
        from ultralytics import YOLO  # heavy import (PyTorch): only when a real model is loaded

        self._model = YOLO(weights)
        self._lock = threading.Lock()
        self.names = [self._model.names[i] for i in sorted(self._model.names)]

    def detect(self, img: Image.Image, min_confidence: float) -> list[Detection]:
        with self._lock:
            result = self._model.predict(img, conf=min_confidence, verbose=False)[0]
        return [
            Detection(self._model.names[int(cls)], round(float(conf), 4))
            for cls, conf in zip(result.boxes.cls.tolist(), result.boxes.conf.tolist())
        ]
