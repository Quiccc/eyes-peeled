"""
Build the shared model's training set from COCO plus your own labeled photos.

Output (YOLO format) in training/dataset/:
  images/{train,val}/  labels/{train,val}/  data.yaml

Sources:
  --coco DIR     a COCO dataset in YOLO format, as Ultralytics downloads it (datasets/coco with
                 images/train2017, labels/train2017, images/val2017, labels/val2017). Only boxes of
                 classes in classes.yaml are kept; images with none of them are skipped.
  --custom DIR   your own labeled photos exported in YOLO format (e.g. Label Studio "YOLO" export:
                 classes.txt, images/, labels/). Repeat for several folders. Class names must be
                 in classes.yaml. 15% go to val, chosen by file name so it's stable between runs.

Class ids are remapped by name to the order in classes.yaml, so sources can use any numbering.
Rebuild from scratch every time (the folder is cleared). Keep your custom photo folders backed up:
they, not the model files, are the long-term asset.

  uv run python training/build_dataset.py --coco D:/datasets/coco --custom D:/labels/batch-2026-12
"""

import argparse
import hashlib
import shutil
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # run as a script from anywhere

from wordhunt_yolo.common import IMAGE_TYPES, TRAINING_DIR, load_classes  # noqa: E402


class DatasetError(Exception):
    """A source folder can't be used; main() prints it and exits."""

# COCO class order (ids 0-79), as used by Ultralytics' coco.yaml.
COCO_NAMES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog",
    "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
    "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
    "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
    "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant",
    "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
    "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors",
    "teddy bear", "hair drier", "toothbrush",
]
assert len(COCO_NAMES) == 80


def copy_pair(img: Path, lines: list[str], split: str, out: Path, prefix: str) -> None:
    name = f"{prefix}_{img.stem}"
    shutil.copy2(img, out / "images" / split / f"{name}{img.suffix.lower()}")
    (out / "labels" / split / f"{name}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def remap(label_file: Path, names: list[str], index: dict[str, int]) -> list[str]:
    """YOLO label lines with class ids translated from `names` order to ours. Other classes and
    malformed lines are dropped."""
    lines = []
    if not label_file.is_file():
        return lines
    for line in label_file.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 5 or not parts[0].isdigit():
            continue
        cls = int(parts[0])
        if cls < len(names) and names[cls] in index:
            lines.append(" ".join([str(index[names[cls]]), *parts[1:]]))
    return lines


def add_coco(root: Path, out: Path, classes: list[str], cap: int) -> dict[str, int]:
    index = {n: i for i, n in enumerate(classes)}
    counts = {n: 0 for n in index}
    for split, coco_split in (("train", "train2017"), ("val", "val2017")):
        limit = cap if split == "train" else max(1, cap // 10)
        per_class = {n: 0 for n in index}
        images = root / "images" / coco_split
        if not images.is_dir():
            raise DatasetError(f"Not found: {images}")
        for img in sorted(images.iterdir()):
            lines = remap(root / "labels" / coco_split / f"{img.stem}.txt", COCO_NAMES, index)
            if not lines:
                continue
            present = {classes[int(l.split()[0])] for l in lines}
            # Keep the image while any class in it still needs examples.
            if all(per_class[n] >= limit for n in present):
                continue
            for n in present:
                per_class[n] += 1
                counts[n] += 1
            copy_pair(img, lines, split, out, "coco")
    return counts


def add_custom(root: Path, out: Path, classes: list[str]) -> dict[str, int]:
    index = {n: i for i, n in enumerate(classes)}
    names_file = root / "classes.txt"
    if not names_file.is_file():
        raise DatasetError(f"{root} has no classes.txt")
    names = [n.strip() for n in names_file.read_text(encoding="utf-8").splitlines() if n.strip()]
    unknown = [n for n in names if n not in index]
    if unknown:
        raise DatasetError(f"{root}: classes not in classes.yaml: {unknown}. Append them there first.")
    counts = {n: 0 for n in index}
    for img in sorted((root / "images").rglob("*")):
        if img.suffix.lower() not in IMAGE_TYPES:
            continue
        lines = remap(root / "labels" / f"{img.stem}.txt", names, index)
        if not lines:
            continue
        split = "val" if int(hashlib.sha1(img.name.encode()).hexdigest(), 16) % 100 < 15 else "train"
        for l in lines:
            counts[classes[int(l.split()[0])]] += 1
        copy_pair(img, lines, split, out, root.name)
    return counts


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coco", type=Path)
    ap.add_argument("--custom", type=Path, action="append", default=[])
    ap.add_argument("--coco-per-class", type=int, default=1500, help="max COCO train images per class")
    ap.add_argument("--out", type=Path, default=TRAINING_DIR / "dataset")
    args = ap.parse_args()
    if not args.coco and not args.custom:
        ap.error("give --coco and/or --custom")

    classes = load_classes()
    if args.out.exists():
        shutil.rmtree(args.out)
    for d in ("images/train", "images/val", "labels/train", "labels/val"):
        (args.out / d).mkdir(parents=True)

    totals = {n: 0 for n in classes}
    try:
        if args.coco:
            for n, c in add_coco(args.coco, args.out, classes, args.coco_per_class).items():
                totals[n] += c
        for folder in args.custom:
            for n, c in add_custom(folder, args.out, classes).items():
                totals[n] += c
    except DatasetError as e:
        print(e, file=sys.stderr)
        return 1

    data = {"path": str(args.out.resolve()), "train": "images/train", "val": "images/val",
            "names": dict(enumerate(classes))}
    (args.out / "data.yaml").write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")

    print(f"{'class':<18} examples")
    for n in classes:
        flag = "  <- too few, aim for 300+" if totals[n] < 300 else ""
        print(f"{n:<18} {totals[n]:>8}{flag}")
    print(f"\nWrote {args.out / 'data.yaml'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
