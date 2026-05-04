import time
import threading
import socketserver
from config import SCAN_INTERVAL, PORT
from state import state
from auditor import RepoAuditor
import server
import database


def scanner_job():
    state.set_running(True)
    try:
        print("\n--- 🛡️ Iniciando Protocolo de Scan (SQLite Mode) ---")

        active_repos = database.get_active_repos()

        if not active_repos:
            print("Nenhum repositório ativo configurado no banco de dados.")
            state.save([])
            state.set_running(False)
            return

        results = []
        for r in active_repos:
            repo_data = dict(r)
            repo_data["git"] = repo_data["git_url"]
            results.append(RepoAuditor(repo_data).run())

        for repo_result in results:
            vulns = repo_result.get("audit_items", [])
            outdated = repo_result.get("outdated", [])

            database.sync_threats(repo_result["id"], vulns)
            database.sync_tech_debt(repo_result["id"], outdated)

        state.save(results)
        print("--- ✅ Scan Finalizado e Threat Intel Atualizado ---\n")

    except Exception as e:
        print(f"❌ Job falhou: {e}")
    finally:
        state.set_running(False)


def scheduler():
    while True:
        scanner_job()
        time.sleep(SCAN_INTERVAL)


if __name__ == "__main__":
    server.trigger_scan_callback = scanner_job
    t = threading.Thread(target=scheduler, daemon=True)
    t.start()
    print(f"🚀 Sentinel Ops [SaaS Edition] operando na porta {PORT}")
    socketserver.TCPServer(("0.0.0.0", PORT), server.SentinelHandler).serve_forever()
