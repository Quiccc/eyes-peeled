"""Regression tests for model-version naming, the append-only check and concurrent /detect."""

import threading
import time
from concurrent.futures import ThreadPoolExecutor

from wordhunt_yolo import common
from wordhunt_yolo.common import is_own_release, version_from_weights
from wordhunt_yolo.config import load_settings
from wordhunt_yolo.detector import YoloDetector


def test_version_comes_from_the_release_folder():
    assert version_from_weights("models/v2/best.pt") == "v2"
    assert version_from_weights("C:/word-hunt/yolo/models/v7/last.pt") == "v7"
    assert version_from_weights("yolo11s.pt") == "yolo11s"
    assert load_settings({"YOLO_MODEL": "models/v3/best.pt"}).model_version == "v3"


def test_own_release_is_recognized_relative_or_absolute(tmp_path, monkeypatch):
    models = tmp_path / "models"
    (models / "v1").mkdir(parents=True)
    (models / "v1" / "best.pt").write_bytes(b"")
    monkeypatch.setattr(common, "ROOT", tmp_path)
    monkeypatch.setattr(common, "MODELS_DIR", models)
    assert is_own_release("models/v1/best.pt")  # as written in the README, relative to yolo/
    assert is_own_release(str(models / "v1" / "best.pt"))
    assert not is_own_release("yolo11s.pt")


def test_predictions_take_turns():
    """The real detector must not run two predictions at once on the shared model."""
    active = 0
    overlap = False
    guard = threading.Lock()

    class Boxes:
        cls = conf = type("T", (), {"tolist": lambda self: []})()

    class SlowModel:
        names = {0: "cup"}

        def predict(self, *_args, **_kwargs):
            nonlocal active, overlap
            with guard:
                active += 1
                overlap |= active > 1
            time.sleep(0.02)
            with guard:
                active -= 1
            return [type("R", (), {"boxes": Boxes()})()]

    detector = YoloDetector.__new__(YoloDetector)  # skip loading real weights
    detector._model = SlowModel()
    detector._lock = threading.Lock()
    detector.names = ["cup"]
    with ThreadPoolExecutor(4) as pool:
        list(pool.map(lambda _: detector.detect(None, 0.25), range(8)))
    assert not overlap
