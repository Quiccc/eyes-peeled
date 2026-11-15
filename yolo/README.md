# YOLO photo checker

A small FastAPI service. The Express server (`server/`) sends it each photo plus the day's word, and
it answers whether that object is in the picture.

**One shared model** knows every game word. The word comes with each request, so nothing changes at
midnight: the server plans words a month ahead (admin panel → Schedule), and this service just answers
"is a `<word>` in this photo?". New words are added by retraining the same model on all the data
(see [Adding words](#adding-words)).

## Run it

Needs [uv](https://docs.astral.sh/uv/) (`winget install astral-sh.uv`). uv fetches Python 3.12 itself
(pinned in `.python-version`), because PyTorch usually has no wheels for the newest Python.

```powershell
cd yolo
uv venv
uv pip install -r requirements.txt -r requirements-dev.txt
$env:YOLO_KEY = "change-me-yolo-key"     # same value as YOLO_KEY in server/.env
uv run uvicorn main:app --port 8001
```

The first start downloads `yolo11s.pt` (about 19 MB). Then set `YOLO_URL=http://localhost:8001` in
`server/.env` and restart the server.

| Env | Default | |
|---|---|---|
| `YOLO_MODEL` | `yolo11s.pt` | Weights file, e.g. `models/v2/best.pt` |
| `MODEL_VERSION` | weights file name | Shown in `/health` and the admin panel |
| `YOLO_KEY` | empty (no check) | Shared secret, sent by the server as `X-Yolo-Key` |
| `MIN_CONFIDENCE` | `0.25` | Lowest score reported. The server decides pass/fail with `YOLO_MIN_CONFIDENCE` (default 0.5) or a per-word threshold |
| `EVAL_REPORT` | `eval/latest.json` | Word-test report served at `/eval/report` |

## Check it

```powershell
uv run pytest                                       # API tests with the real model
curl http://localhost:8001/health
curl http://localhost:8001/classes                  # every label the model knows
curl -F "image=@cup.jpg" -F "label=cup" -H "X-Yolo-Key: change-me-yolo-key" http://localhost:8001/detect
```

## Word test

Before a word can go into the schedule, check that the model handles it fairly. Put about 20 photos
per word in each folder (the folders are gitignored; back them up):

```
eval/photos/<word>/positive/   the object is in the photo (different angles, light, distances)
eval/photos/<word>/negative/   it isn't: look-alikes (mug vs. cup), photos of screens, empty scenes
```

```powershell
uv run python eval/evaluate.py
```

It prints, per word, how many real photos pass and how many wrong photos pass at the server's
threshold (0.5), and marks each word PASS or FAIL (bars: ≥ 85% real pass, ≤ 5% wrong pass; change with
`--min-pass` / `--max-false`). It writes `eval/report-<version>.json` and `eval/latest.json`; the admin
panel's Model page shows the latest one. Commit the reports so you can compare versions later.

A word that fails: retire it in the admin panel (Words → enabled off), raise its threshold there, or
add training photos and retrain.

## Adding words

Train **one** model on **all** the data every time. Never train on only the new words: the model
forgets the old ones.

1. Append the new words to `training/classes.yaml` (append only, never reorder or remove).
2. Label photos of them (300+ boxes per word is a good start) in a tool like
   [Label Studio](https://labelstud.io/) or [CVAT](https://www.cvat.ai/) and export in **YOLO** format.
   Keep these folders backed up: they are the long-term asset, the model can always be rebuilt from them.
3. Build the dataset (COCO for the stock words + your labeled folders):
   ```powershell
   uv run python training/build_dataset.py --coco D:/datasets/coco --custom D:/labels/batch-1
   ```
   COCO in YOLO format is what Ultralytics downloads for `coco.yaml` (about 20 GB).
4. Train (needs a GPU; a rented one or Colab is fine):
   ```powershell
   uv run python training/train.py --version v1 --base yolo11s.pt      # later: --base models/v1/best.pt
   ```
5. Release check: run the word test on the new model and compare with the current report. Release only
   if it passes, so no old word got worse:
   ```powershell
   uv run python eval/evaluate.py --model models/v1/best.pt --model-version v1 --compare eval/latest.json
   ```
6. Deploy: set `YOLO_MODEL=models/v1/best.pt` and `MODEL_VERSION=v1`, restart. Keep the previous
   `models/` folder to roll back.
7. Add the new words in the admin panel (Words → Add). Only words the running model knows can be added
   or scheduled.

## Notes

- `yolo11s` is a good balance on CPU. `yolo11n` is faster and less accurate; `yolo11m` is more accurate
  and slower.
- `training/classes.yaml` also lists `person`, `tv`, `dining table` and `sink`. They aren't game words,
  but training on them teaches the model what a target is *not*, and makes a later "photo of a screen"
  check possible.
