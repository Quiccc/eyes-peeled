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
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # run as a script from anywhere

from wordhunt_yolo.common import DEFAULT_WEIGHTS, EVAL_DIR, IMAGE_TYPES, version_from_weights, weights_ref  # noqa: E402
from wordhunt_yolo.detector import Detector  # noqa: E402
from wordhunt_yolo.imaging import open_image  # noqa: E402
from wordhunt_yolo.inference import normalize, verdict  # noqa: E402


@dataclass(frozen=True)
class Bars:
    min_pass: float
    max_false: float
    #: Allowed drop against the previous report.
    tolerance: float


def photos(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_TYPES)


def rate(hits: int, total: int) -> float | None:
    return round(hits / total, 4) if total else None


def passes(model: Detector, path: Path, word: str, min_confidence: float) -> bool:
    return verdict(model.detect(open_image(path), min_confidence), word).detected


def grade(word: str, pos_hits: int, pos: int, neg_hits: int, neg: int, bars: Bars, before: dict | None) -> dict:
    """One report row: the rates, and every reason the word fails (empty = PASS)."""
    pass_rate, false_rate = rate(pos_hits, pos), rate(neg_hits, neg)
    problems = []
    if not pos:
        problems.append("no positive photos")
    elif pass_rate < bars.min_pass:
        problems.append(f"only {pass_rate:.0%} of real photos pass (need {bars.min_pass:.0%})")
    if not neg:
        problems.append("no negative photos")
    elif false_rate > bars.max_false:
        problems.append(f"{false_rate:.0%} of wrong photos pass (max {bars.max_false:.0%})")
    if before and pass_rate is not None and before.get("passRate") is not None:
        if pass_rate < before["passRate"] - bars.tolerance:
            problems.append(f"pass rate dropped from {before['passRate']:.0%}")
    if before and false_rate is not None and before.get("falseRate") is not None:
        if false_rate > before["falseRate"] + bars.tolerance:
            problems.append(f"wrong-pass rate rose from {before['falseRate']:.0%}")
    return {"word": word, "pass": not problems, "problems": problems,
            "positives": pos, "positivePassed": pos_hits, "passRate": pass_rate,
            "negatives": neg, "negativePassed": neg_hits, "falseRate": false_rate}


def unknown_word(word: str) -> dict:
    return {"word": word, "pass": False, "problems": ["model doesn't know this word"],
            "positives": 0, "positivePassed": 0, "passRate": None,
            "negatives": 0, "negativePassed": 0, "falseRate": None}


def load_previous(path: Path | None) -> dict[str, dict]:
    """Rows of an earlier report, by word. A report without words compares against nothing."""
    if not path:
        return {}
    return {w["word"]: w for w in json.loads(path.read_text(encoding="utf-8")).get("words", [])}


def evaluate(model: Detector, photo_root: Path, min_confidence: float, bars: Bars, previous: dict[str, dict]) -> list[dict]:
    words = sorted(d.name for d in photo_root.iterdir() if d.is_dir()) if photo_root.is_dir() else []
    known = {normalize(n) for n in model.names}
    rows = []
    for word in words:
        if normalize(word) not in known:
            rows.append(unknown_word(word))
            continue
        pos = photos(photo_root / word / "positive")
        neg = photos(photo_root / word / "negative")
        pos_hits = sum(passes(model, p, word, min_confidence) for p in pos)
        neg_hits = sum(passes(model, p, word, min_confidence) for p in neg)
        rows.append(grade(word, pos_hits, len(pos), neg_hits, len(neg), bars, previous.get(word)))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default=os.environ.get("YOLO_MODEL", DEFAULT_WEIGHTS))
    ap.add_argument("--model-version", default=os.environ.get("MODEL_VERSION"))
    ap.add_argument("--photos", type=Path, default=EVAL_DIR / "photos")
    ap.add_argument("--min-confidence", type=float, default=0.5, help="server pass threshold (YOLO_MIN_CONFIDENCE)")
    ap.add_argument("--min-pass", type=float, default=0.85, help="lowest share of positives that must pass")
    ap.add_argument("--max-false", type=float, default=0.05, help="highest share of negatives allowed to pass")
    ap.add_argument("--compare", type=Path, help="previous report; fail if any word got worse")
    ap.add_argument("--tolerance", type=float, default=0.05, help="allowed drop when comparing")
    ap.add_argument("--out", type=Path, default=EVAL_DIR, help="where the reports are written")
    args = ap.parse_args()

    if not args.photos.is_dir() or not any(d.is_dir() for d in args.photos.iterdir()):
        print(f"No word folders in {args.photos}. Add photos/<word>/positive and photos/<word>/negative.")
        return 1

    from wordhunt_yolo.detector import YoloDetector

    version = args.model_version or version_from_weights(args.model)
    model = YoloDetector(weights_ref(args.model))
    bars = Bars(args.min_pass, args.max_false, args.tolerance)
    rows = evaluate(model, args.photos, args.min_confidence, bars, load_previous(args.compare))

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
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / f"report-{version}.json").write_text(text, encoding="utf-8")
    (args.out / "latest.json").write_text(text, encoding="utf-8")

    pct = lambda v: "  -  " if v is None else f"{v:5.0%}"  # noqa: E731
    print(f"{'word':<18} {'real ok':>8} {'wrong ok':>9}  result")
    for r in rows:
        print(f"{r['word']:<18} {pct(r['passRate']):>8} {pct(r['falseRate']):>9}  "
              f"{'PASS' if r['pass'] else 'FAIL: ' + '; '.join(r['problems'])}")
    failed = [r["word"] for r in rows if not r["pass"]]
    print(f"\n{len(rows) - len(failed)}/{len(rows)} words pass. Report: {args.out / f'report-{version}.json'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
