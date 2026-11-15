import io
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from wordhunt_yolo.api import create_app
from wordhunt_yolo.config import Settings
from wordhunt_yolo.detector import Detection

KEY = {"X-Yolo-Key": "test-key"}
SETTINGS = Settings(key="test-key")


def jpeg(color=(200, 200, 200), size=(320, 240)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "JPEG")
    return buf.getvalue()


class FakeDetector:
    """Knows a few labels and "sees" whatever `next_detections` says. No PyTorch needed."""

    def __init__(self, names=("cup", "Potted Plant", "bus")):
        self.names = list(names)
        self.next_detections: list[Detection] = []
        self.calls: list[float] = []

    def detect(self, img, min_confidence):
        self.calls.append(min_confidence)
        return self.next_detections


@pytest.fixture
def fake():
    return FakeDetector()


@pytest.fixture
def make_client(fake):
    """A client over a fake model; pass Settings overrides, e.g. make_client(eval_report=path)."""
    clients = []

    def make(**overrides):
        c = TestClient(create_app(replace(SETTINGS, **overrides), detector=fake))
        clients.append(c.__enter__())
        return c

    yield make
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture(scope="session")
def client():
    """The real model (downloads yolo11s.pt on first use). Loaded once for the whole session."""
    with TestClient(create_app(SETTINGS)) as c:
        yield c
