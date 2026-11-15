import os
import sys
from pathlib import Path

import pytest

# Settings must be in place before main.py is imported, because it reads them at import time.
os.environ["YOLO_KEY"] = "test-key"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

KEY = {"X-Yolo-Key": "test-key"}


@pytest.fixture(scope="session")
def client():
    # Entering the client runs the lifespan, which loads the model once for the whole session.
    with TestClient(main.app) as c:
        yield c
