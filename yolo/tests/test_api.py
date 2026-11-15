"""The service with the real model: what the Express server relies on end to end."""

import re
from pathlib import Path

from ultralytics.utils import ASSETS

from conftest import KEY, SETTINGS, jpeg

SEED_WORDS = Path(__file__).resolve().parents[2] / "server" / "src" / "seed" / "words.ts"


def seed_words() -> set[str]:
    text = SEED_WORDS.read_text(encoding="utf-8")
    pool = text[text.index("WORD_POOL") : text.index("} as const")]
    return set(re.findall(r"'([^']+)'", pool))


def test_health(client):
    body = client.get("/health").json()
    assert body["ok"] is True
    assert body["classes"] > 0
    assert body["modelVersion"]


def test_model_knows_every_seeded_word(client):
    known = set(client.get("/classes").json())
    missing = seed_words() - known
    assert not missing, f"words the model doesn't know: {sorted(missing)}"


def test_bad_key(client):
    r = client.post("/detect", files={"image": ("a.jpg", jpeg())}, data={"label": "cup"})
    assert r.status_code == 401


def test_unknown_label(client):
    r = client.post("/detect", files={"image": ("a.jpg", jpeg())}, data={"label": "unicorn"}, headers=KEY)
    assert r.status_code == 400


def test_not_an_image(client):
    r = client.post("/detect", files={"image": ("a.jpg", b"hello")}, data={"label": "cup"}, headers=KEY)
    assert r.status_code == 400


def test_too_large(client):
    big = b"0" * (SETTINGS.max_image_bytes + 1)
    r = client.post("/detect", files={"image": ("a.jpg", big)}, data={"label": "cup"}, headers=KEY)
    assert r.status_code == 413


def test_blank_photo_is_not_a_find(client):
    r = client.post("/detect", files={"image": ("a.jpg", jpeg())}, data={"label": "cup"}, headers=KEY)
    assert r.status_code == 200
    assert r.json()["detected"] is False
    assert r.json()["confidence"] is None


def test_real_photo_is_a_find(client):
    # bus.jpg ships with Ultralytics: a bus with people in front of it.
    photo = (Path(ASSETS) / "bus.jpg").read_bytes()
    r = client.post("/detect", files={"image": ("bus.jpg", photo)}, data={"label": "bus"}, headers=KEY)
    body = r.json()
    assert body["detected"] is True
    assert body["confidence"] >= 0.5
    assert any(l["label"] == "bus" for l in body["labels"])
