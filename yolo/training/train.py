"""
Train a new version of the shared model on the FULL dataset (all words, old and new).

Never train on only the new words: the model would forget the old ones. Starting from the previous
release's weights is fine and faster, as long as the dataset still contains every word.

  uv run python training/train.py --version v2 --base models/v1/best.pt
  uv run python training/train.py --version v1 --base yolo11s.pt      # first custom model

Output: models/<version>/best.pt and models/<version>/classes.txt. Then run the word test with
--compare against the current report, and only release if it passes (see yolo/README.md).
Needs a GPU for reasonable times (local CUDA, a rented GPU or Colab). --device cpu works but is slow.
"""

import argparse
import shutil
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # run as a script from anywhere

from wordhunt_yolo.common import (  # noqa: E402
    DEFAULT_WEIGHTS,
    MODELS_DIR,
    ROOT,
    TRAINING_DIR,
    is_own_release,
    load_classes,
    weights_ref,
)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--version", required=True, help="e.g. v2; becomes models/<version>/")
    ap.add_argument("--base", default=DEFAULT_WEIGHTS, help="previous best.pt, or a stock model")
    ap.add_argument("--data", type=Path, default=TRAINING_DIR / "dataset" / "data.yaml")
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--device", default=None, help="0 for the first GPU, cpu, ...")
    args = ap.parse_args()

    out = MODELS_DIR / args.version
    if out.exists():
        sys.exit(f"{out} already exists. Pick a new version name; old versions are kept for rollback.")
    if not args.data.is_file():
        sys.exit(f"{args.data} not found. Run training/build_dataset.py first.")

    classes = load_classes()
    data_names = list(yaml.safe_load(args.data.read_text(encoding="utf-8"))["names"].values())
    if data_names != classes:
        sys.exit("dataset is out of date with classes.yaml. Rebuild it with training/build_dataset.py.")

    from ultralytics import YOLO

    model = YOLO(weights_ref(args.base))
    base_names = list(model.names.values())
    # One of our own releases: its classes must be the start of the current list (append-only rule).
    if is_own_release(args.base) and classes[: len(base_names)] != base_names:
        sys.exit("classes.yaml no longer starts with the base model's classes. Only append to it.")

    model.train(data=str(args.data), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
                device=args.device, project=str(ROOT / "runs"), name=args.version, exist_ok=False)

    best = Path(model.trainer.best)
    out.mkdir(parents=True)
    shutil.copy2(best, out / "best.pt")
    (out / "classes.txt").write_text("\n".join(classes) + "\n", encoding="utf-8")
    print(f"\nSaved {out / 'best.pt'}. Next:")
    print(f"  uv run python eval/evaluate.py --model {out / 'best.pt'} --model-version {args.version} "
          "--compare eval/latest.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
