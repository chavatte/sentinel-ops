import os

PORT = int(os.getenv("PORT", 8080))
SCAN_INTERVAL = int(os.getenv("SCAN_INTERVAL", 21600)) 

CONFIG_FILE = "/config/repos.yml"
DATA_DIR = "/data"
SSH_DIR = "/ssh"

os.makedirs(DATA_DIR, exist_ok=True)