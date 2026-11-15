"""The word test's grading and the dataset builder's label handling."""

import sys
from pathlib import Path

import pytest

from conftest import FakeDetector
from wordhunt_yolo.config import load_settings
from wordhunt_yolo.detector import Detection

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "eval"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))

import build_dataset  # noqa: E402
import evaluate  # noqa: E402

BARS = evaluate.Bars(min_pass=0.85, max_false=0.05, tolerance=0.05)


class TestGrade:
    def test_pass(self):
        row = evaluate.grade("cup", 18, 20, 0, 20, BARS, None)
        assert row["pass"] is True
        assert (row["passRate"], row["falseRate"]) == (0.9, 0.0)

    def test_too_few_real_photos_pass(self):
        row = evaluate.grade("cup", 10, 20, 0, 20, BARS, None)
        assert row["problems"] == ["only 50% of real photos pass (need 85%)"]

    def test_too_many_wrong_photos_pass(self):
        row = evaluate.grade("cup", 20, 20, 4, 20, BARS, None)
        assert row["problems"] == ["20% of wrong photos pass (max 5%)"]

    def test_missing_photos(self):
        assert evaluate.grade("cup", 0, 0, 0, 0, BARS, None)["problems"] == ["no positive photos", "no negative photos"]

    def test_regression_against_previous_report(self):
        before = {"passRate": 1.0, "falseRate": 0.0}
        row = evaluate.grade("cup", 18, 20, 1, 20, BARS, before)
        assert row["problems"] == ["pass rate dropped from 100%"]

    def test_previous_report_without_words(self, tmp_path):
        old = tmp_path / "old.json"
        old.write_text("{}", encoding="utf-8")
        assert evaluate.load_previous(old) == {}


def test_evaluate_uses_the_photo_folders(tmp_path, monkeypatch):
    for kind in ("positive", "negative"):
        (tmp_path / "cup" / kind).mkdir(parents=True)
        (tmp_path / "cup" / kind / "a.jpg").write_bytes(b"")
    (tmp_path / "unicorn").mkdir()
    monkeypatch.setattr(evaluate, "open_image", lambda path: path.parent.name)

    class SeesPositives(FakeDetector):
        def detect(self, img, min_confidence):
            return [Detection("cup", 0.9)] if img == "positive" else []

    rows = {r["word"]: r for r in evaluate.evaluate(SeesPositives(), tmp_path, 0.5, BARS, {})}
    assert rows["cup"]["pass"] is True
    assert rows["unicorn"]["problems"] == ["model doesn't know this word"]


class TestRemap:
    def test_translates_class_ids_by_name(self, tmp_path):
        labels = tmp_path / "a.txt"
        labels.write_text("0 0.5 0.5 0.1 0.1\n2 0.1 0.1 0.2 0.2\n1 0.3 0.3 0.1 0.1\n", encoding="utf-8")
        lines = build_dataset.remap(labels, ["cup", "dog", "chair"], {"chair": 0, "cup": 1})
        assert lines == ["1 0.5 0.5 0.1 0.1", "0 0.1 0.1 0.2 0.2"]

    def test_skips_malformed_lines_and_missing_files(self, tmp_path):
        labels = tmp_path / "a.txt"
        labels.write_text("x 0.5 0.5 0.1 0.1\n0 0.5\n", encoding="utf-8")
        assert build_dataset.remap(labels, ["cup"], {"cup": 0}) == []
        assert build_dataset.remap(tmp_path / "missing.txt", ["cup"], {"cup": 0}) == []

    def test_custom_folder_with_unknown_classes(self, tmp_path):
        (tmp_path / "classes.txt").write_text("unicorn\n", encoding="utf-8")
        with pytest.raises(build_dataset.DatasetError, match="unicorn"):
            build_dataset.add_custom(tmp_path, tmp_path / "out", ["cup"])


class TestSettings:
    def test_defaults(self):
        s = load_settings({})
        assert (s.model, s.model_version, s.key, s.min_confidence) == ("yolo11s.pt", "yolo11s", "", 0.25)

    def test_env(self):
        s = load_settings({"YOLO_MODEL": "models/v2/best.pt", "MODEL_VERSION": "v2", "MIN_CONFIDENCE": "0.3"})
        assert (s.model_version, s.min_confidence) == ("v2", 0.3)

    @pytest.mark.parametrize("bad", ["abc", "1.5", "-0.1"])
    def test_bad_confidence_stops_startup(self, bad):
        with pytest.raises(SystemExit):
            load_settings({"MIN_CONFIDENCE": bad})
