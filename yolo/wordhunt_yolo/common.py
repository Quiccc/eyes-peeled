"""Paths and constants shared by the service, the word test and the training scripts."""

from pathlib import Path

import yaml

#: The yolo/ folder. Relative paths in settings and scripts are resolved from here, not the cwd.
ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
EVAL_DIR = ROOT / "eval"
TRAINING_DIR = ROOT / "training"
CLASSES_FILE = TRAINING_DIR / "classes.yaml"

#: Stock Ultralytics weights used until the first custom model (downloaded on first use).
DEFAULT_WEIGHTS = "yolo11s.pt"

#: Photo files the word test and dataset builder pick up.
IMAGE_TYPES = frozenset({".jpg", ".jpeg", ".png", ".webp"})

#: Largest photo accepted. Same limit as the API server's upload limit.
MAX_IMAGE_BYTES = 8 * 1024 * 1024


def resolve(path: str | Path) -> Path:
    """`path` as given if absolute, otherwise relative to yolo/."""
    p = Path(path)
    return p if p.is_absolute() else ROOT / p


def weights_ref(name: str) -> str:
    """What to pass to YOLO(): a local file (relative to yolo/) when it exists, else the name as is,
    so stock names like "yolo11s.pt" still download."""
    local = resolve(name)
    return str(local) if local.is_file() else name


def version_from_weights(name: str) -> str:
    """Version shown when MODEL_VERSION isn't set: the weights file name, e.g. "yolo11s"."""
    return Path(name).stem


def load_classes() -> list[str]:
    """Every word the shared model knows, in class-id order (training/classes.yaml, append only)."""
    return yaml.safe_load(CLASSES_FILE.read_text(encoding="utf-8"))["classes"]
