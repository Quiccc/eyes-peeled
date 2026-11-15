"""The HTTP contract with a fake model: fast, and no PyTorch needed."""

import io
import json

from PIL import Image

from conftest import KEY, jpeg
from wordhunt_yolo.detector import Detection


def test_detect_reports_the_best_score_of_the_target(make_client, fake):
    fake.next_detections = [Detection("cup", 0.41), Detection("bus", 0.9), Detection("cup", 0.77)]
    r = make_client().post("/detect", files={"image": ("a.jpg", jpeg())}, data={"label": "cup"}, headers=KEY)
    assert r.json() == {
        "detected": True,
        "confidence": 0.77,
        "labels": [
            {"label": "cup", "confidence": 0.41},
            {"label": "bus", "confidence": 0.9},
            {"label": "cup", "confidence": 0.77},
        ],
    }
    assert fake.calls == [0.25]  # the service's MIN_CONFIDENCE goes to the model


def test_labels_match_without_case_or_spaces(make_client, fake):
    fake.next_detections = [Detection("Potted Plant", 0.6)]
    r = make_client().post(
        "/detect", files={"image": ("a.jpg", jpeg())}, data={"label": "  potted plant "}, headers=KEY
    )
    assert r.json()["detected"] is True


def test_target_not_seen(make_client, fake):
    fake.next_detections = [Detection("bus", 0.9)]
    r = make_client().post("/detect", files={"image": ("a.jpg", jpeg())}, data={"label": "cup"}, headers=KEY)
    assert r.json()["detected"] is False
    assert r.json()["confidence"] is None


def test_wrong_key_and_no_key(make_client):
    c = make_client()
    for headers in ({}, {"X-Yolo-Key": "nope"}):
        r = c.post("/detect", files={"image": ("a.jpg", jpeg())}, data={"label": "cup"}, headers=headers)
        assert r.status_code == 401


def test_no_key_configured_means_no_check(make_client):
    r = make_client(key="").post("/detect", files={"image": ("a.jpg", jpeg())}, data={"label": "cup"})
    assert r.status_code == 200


def test_png_and_exif_rotation(make_client, fake):
    buf = io.BytesIO()
    Image.new("RGBA", (40, 20)).save(buf, "PNG")
    r = make_client().post("/detect", files={"image": ("a.png", buf.getvalue())}, data={"label": "cup"}, headers=KEY)
    assert r.status_code == 200


def test_health_and_classes_need_no_key(make_client):
    c = make_client(model="models/v3/best.pt", model_version="v3")
    assert c.get("/health").json() == {"ok": True, "model": "models/v3/best.pt", "modelVersion": "v3", "classes": 3}
    assert c.get("/classes").json() == ["Potted Plant", "bus", "cup"]


def test_eval_report(make_client, tmp_path):
    path = tmp_path / "latest.json"
    c = make_client(eval_report=path)
    assert c.get("/eval/report", headers=KEY).status_code == 404
    path.write_text(json.dumps({"modelVersion": "x", "words": []}), encoding="utf-8")
    assert c.get("/eval/report", headers=KEY).json()["modelVersion"] == "x"
    assert c.get("/eval/report").status_code == 401
    path.write_text("{ not json", encoding="utf-8")
    assert c.get("/eval/report", headers=KEY).status_code == 500
