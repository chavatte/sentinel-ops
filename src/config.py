import os

APP_VERSION = "2.0.0"

PORT = int(os.getenv("PORT", 8080))
SCAN_INTERVAL = int(os.getenv("SCAN_INTERVAL", 21600))

DATA_DIR = "./data" if os.name == "nt" else "/data"
SSH_DIR = "./ssh" if os.name == "nt" else "/ssh"

os.makedirs(DATA_DIR, exist_ok=True)
