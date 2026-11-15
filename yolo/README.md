# YOLO photo checker

A small FastAPI service. The Express server (`server/`) sends it each photo plus the day's word, and it answers whether that object is in the picture.

## Run it

Use **Python 3.12**. PyTorch, which Ultralytics needs, usually has no wheels for the newest Python yet.

```powershell
cd yolo
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
$env:YOLO_KEY = "change-me-yolo-key"     # same value as YOLO_KEY in server/.env
uvicorn main:app --port 8001
```

The first start downloads `yolo11n.pt` (about 6 MB). Then set `YOLO_URL=http://localhost:8001` in `server/.env` and restart the server.

## Check it

```powershell
curl http://localhost:8001/health
curl http://localhost:8001/classes                  # every label the model knows
curl -F "image=@cup.jpg" -F "label=cup" -H "X-Yolo-Key: change-me-yolo-key" http://localhost:8001/detect
```

## Notes

- The stock model knows the 80 COCO classes. Every word in `server/src/seed/words.ts` is one of them. If you train your own model, set `YOLO_MODEL=path/to/best.pt` and only seed words that are in `/classes`.
- `yolo11n` is the smallest and fastest model. `yolo11s.pt` or `yolo11m.pt` are more accurate, but slower on CPU.
- `MIN_CONFIDENCE` (default 0.25) is the lowest score this service reports. The server decides pass or fail using `YOLO_MIN_CONFIDENCE` (default 0.5).
