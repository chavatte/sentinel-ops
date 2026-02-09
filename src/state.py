import json
import os
import threading
import time
from config import DATA_DIR


class AppState:
    def __init__(self):
        self.lock = threading.Lock()
        self.file_path = os.path.join(DATA_DIR, "status.json")
        self.data = self._load()

    def _load(self):
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r") as f:
                    return json.load(f)
            except:
                pass
        return {"generated_at": 0, "running": False, "results": []}

    def save(self, results):
        with self.lock:
            self.data["results"] = results
            self.data["generated_at"] = int(time.time())
            self.data["running"] = False
            with open(self.file_path, "w") as f:
                json.dump(self.data, f)

    def set_running(self, is_running):
        with self.lock:
            self.data["running"] = is_running


state = AppState()
