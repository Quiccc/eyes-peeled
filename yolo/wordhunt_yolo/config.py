"""Service settings, read from the environment once at startup."""

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from .common import DEFAULT_WEIGHTS, EVAL_DIR, MAX_IMAGE_BYTES, resolve, version_from_weights


@dataclass(frozen=True)
class Settings:
    #: Weights file (relative to yolo/) or an Ultralytics model name.
    model: str = DEFAULT_WEIGHTS
    #: Name shown in /health and the admin panel.
    model_version: str = version_from_weights(DEFAULT_WEIGHTS)
    #: Shared secret; requests must send X-Yolo-Key with this value. Empty = no check.
    key: str = ""
    #: Lowest score reported as a detection. The API server applies its own, higher, pass threshold.
    min_confidence: float = 0.25
    #: Word-test report served at /eval/report.
    eval_report: Path = EVAL_DIR / "latest.json"
    max_image_bytes: int = MAX_IMAGE_BYTES


def load_settings(env: Mapping[str, str] = os.environ) -> Settings:
    """Settings from YOLO_MODEL, MODEL_VERSION, YOLO_KEY, MIN_CONFIDENCE and EVAL_REPORT."""
    model = env.get("YOLO_MODEL") or DEFAULT_WEIGHTS
    min_confidence = _probability(env.get("MIN_CONFIDENCE"), default=0.25, name="MIN_CONFIDENCE")
    eval_report = env.get("EVAL_REPORT")
    return Settings(
        model=model,
        model_version=env.get("MODEL_VERSION") or version_from_weights(model),
        key=env.get("YOLO_KEY", ""),
        min_confidence=min_confidence,
        eval_report=resolve(eval_report) if eval_report else EVAL_DIR / "latest.json",
    )


def _probability(raw: str | None, *, default: float, name: str) -> float:
    if raw is None or raw.strip() == "":
        return default
    try:
        value = float(raw)
    except ValueError:
        raise SystemExit(f"{name} must be a number between 0 and 1, got {raw!r}") from None
    if not 0 <= value <= 1:
        raise SystemExit(f"{name} must be between 0 and 1, got {value}")
    return value
