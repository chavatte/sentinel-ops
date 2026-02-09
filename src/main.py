import os
import yaml
import time
import threading
import socketserver
from config import CONFIG_FILE, SCAN_INTERVAL, PORT
from state import state
from auditor import RepoAuditor
import server

def scanner_job():
    state.set_running(True)
    try:
        if not os.path.exists(CONFIG_FILE):
            print(f"Config não encontrada: {CONFIG_FILE}")
            state.set_running(False)
            return
        
        print("--- Iniciando Scan ---")
        with open(CONFIG_FILE) as f: config = yaml.safe_load(f)
        results = [RepoAuditor(r).run() for r in config.get('repos', [])]
        state.save(results)
        print("--- Scan Finalizado ---")

    except Exception as e:
        print(f"Job falhou: {e}")
        state.set_running(False)

def scheduler():
    while True:
        scanner_job()
        time.sleep(SCAN_INTERVAL)

if __name__ == "__main__":
    server.trigger_scan_callback = scanner_job
    t = threading.Thread(target=scheduler, daemon=True)
    t.start()
    print(f"Sentinel Ops Modular rodando na porta {PORT}")
    socketserver.TCPServer(('0.0.0.0', PORT), server.SentinelHandler).serve_forever()