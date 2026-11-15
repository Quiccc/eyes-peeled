"""
Word test: how well does a model handle each game word?

Photos live in eval/photos/<word>/positive/*.jpg (the object is there) and
eval/photos/<word>/negative/*.jpg (it isn't: look-alikes, screens, empty scenes). About 20 of each.
Folder names use the model's label, e.g. "potted plant", "cell phone".

For each word it reports how many positives pass and how many negatives wrongly pass at the
server's threshold, and marks the word PASS or FAIL against the bars. Writes
eval/report-<modelVersion>.json and eval/latest.json (served by the YOLO service at /eval/report
and shown in the admin panel). Exit code 1 if any word fails, so it can gate a model release.

  uv run python eval/evaluate.py
  uv run python eval/evaluate.py --model models/v2/best.pt --model-version v2 --compare eval/report-v1.json
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps
from ultralytics import YOLO

HERE = Path(__file__).resolve().parent
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp"}


def photos(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_TYPES)


def found(model: YOLO, path: Path, target: str, min_confidence: float) -> bool:
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    result = model.predict(img, conf=min_confidence, verbose=False)[0]
    return any(model.names[int(c)].lower() == target for c in result.boxes.cls.tolist())


def rate(hits: int, total: int) -> float | None:
    return round(hits / total, 4) if total else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default=os.environ.get("YOLO_MODEL", "yolo11s.pt"))
    ap.add_argument("--model-version", default=os.environ.get("MODEL_VERSION"))
    ap.add_argument("--photos", type=Path, default=HERE / "photos")
    ap.add_argument("--min-confidence", type=float, default=0.5, help="server pass threshold")
    ap.add_argument("--min-pass", type=float, default=0.85, help="lowest share of positives that must pass")
    ap.add_argument("--max-false", type=float, default=0.05, help="highest share of negatives allowed to pass")
    ap.add_argument("--compare", type=Path, help="previous report; fail if any word got worse")
    ap.add_argument("--tolerance", type=float, default=0.05, help="allowed drop when comparing")
    args = ap.parse_args()

    version = args.model_version or Path(args.model).stem
    model = YOLO(args.model)
    known = {n.lower() for n in model.names.values()}
    previous = {}
    if args.compare:
        previous = {w["word"]: w for w in json.loads(args.compare.read_text(encoding="utf-8"))["words"]}

    words = sorted(d.name for d in args.photos.iterdir() if d.is_dir()) if args.photos.is_dir() else []
    if not words:
        print(f"No word folders in {args.photos}. Add photos/<word>/positive and photos/<word>/negative.")
        return 1

    rows = []
    for word in words:
        target = word.lower()
        problems = []
        if target not in known:
            rows.append({"word": word, "pass": False, "problems": ["model doesn't know this word"],
                         "positives": 0, "positivePassed": 0, "passRate": None,
                         "negatives": 0, "negativePassed": 0, "falseRate": None})
            continue
        pos = photos(args.photos / word / "positive")
        neg = photos(args.photos / word / "negative")
        pos_hits = sum(found(model, p, target, args.min_confidence) for p in pos)
        neg_hits = sum(found(model, p, target, args.min_confidence) for p in neg)
        pass_rate, false_rate = rate(pos_hits, len(pos)), rate(neg_hits, len(neg))

        if not pos:
            problems.append("no positive photos")
        elif pass_rate < args.min_pass:
            problems.append(f"only {pass_rate:.0%} of real photos pass (need {args.min_pass:.0%})")
        if not neg:
            problems.append("no negative photos")
        elif false_rate > args.max_false:
            problems.append(f"{false_rate:.0%} of wrong photos pass (max {args.max_false:.0%})")
        before = previous.get(word)
        if before and pass_rate is not None and before.get("passRate") is not None:
            if pass_rate < before["passRate"] - args.tolerance:
                problems.append(f"pass rate dropped from {before['passRate']:.0%}")
        if before and false_rate is not None and before.get("falseRate") is not None:
            if false_rate > before["falseRate"] + args.tolerance:
                problems.append(f"wrong-pass rate rose from {before['falseRate']:.0%}")

        rows.append({"word": word, "pass": not problems, "problems": problems,
                     "positives": len(pos), "positivePassed": pos_hits, "passRate": pass_rate,
                     "negatives": len(neg), "negativePassed": neg_hits, "falseRate": false_rate})

    report = {
        "modelVersion": version,
        "model": args.model,
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "minConfidence": args.min_confidence,
        "bars": {"minPass": args.min_pass, "maxFalse": args.max_false},
        "comparedWith": str(args.compare) if args.compare else None,
        "words": rows,
    }
    text = json.dumps(report, indent=2)
    (HERE / f"report-{version}.json").write_text(text, encoding="utf-8")
    (HERE / "latest.json").write_text(text, encoding="utf-8")

    pct = lambda v: "  -  " if v is None else f"{v:5.0%}"  # noqa: E731
    print(f"{'word':<18} {'real ok':>8} {'wrong ok':>9}  result")
    for r in rows:
        print(f"{r['word']:<18} {pct(r['passRate']):>8} {pct(r['falseRate']):>9}  "
              f"{'PASS' if r['pass'] else 'FAIL: ' + '; '.join(r['problems'])}")
    failed = [r["word"] for r in rows if not r["pass"]]
    print(f"\n{len(rows) - len(failed)}/{len(rows)} words pass. Report: eval/report-{version}.json")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
