import http.server
import json
import threading
import urllib.parse
import urllib.request
import re
from config import APP_VERSION
from state import state
import database

trigger_scan_callback = None


def check_docker_hub_update():
    try:
        url = "https://hub.docker.com/v2/repositories/chavatte/sentinel-ops/tags?page_size=20"
        req = urllib.request.Request(url, headers={"User-Agent": "Sentinel-Ops/1.0"})

        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode())

            tags = []
            for t in data.get("results", []):
                name = t.get("name", "")
                if re.match(r"^\d+\.\d+\.\d+$", name):
                    tags.append(name)

            if not tags:
                return None

            tags.sort(key=lambda s: [int(u) for u in s.split(".")], reverse=True)
            latest_tag = tags[0]

            curr_ver = [int(u) for u in APP_VERSION.split(".")]
            lat_ver = [int(u) for u in latest_tag.split(".")]

            if lat_ver > curr_ver:
                return latest_tag
    except Exception as e:
        print(f"Erro ao checar atualizações no Docker Hub: {e}")
    return None


class SentinelHandler(http.server.SimpleHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)

        if parsed_path.path == "/api/status":
            self._set_headers()
            with state.lock:
                self.wfile.write(json.dumps(state.data).encode())
            return

        if parsed_path.path == "/api/repos":
            self._set_headers()
            repos = database.get_all_repos()
            self.wfile.write(json.dumps(repos).encode())
            return

        if parsed_path.path == "/api/metrics":
            self._set_headers()
            metrics = database.get_metrics()
            self.wfile.write(json.dumps(metrics).encode())
            return

        if parsed_path.path == "/api/update":
            self._set_headers()
            latest = check_docker_hub_update()
            res = {
                "update_available": bool(latest),
                "latest_version": latest,
                "current_version": APP_VERSION,
            }
            self.wfile.write(json.dumps(res).encode())
            return

        if parsed_path.path == "/api/run":
            self._trigger_run()
            return

        if self.path == "/" or self.path == "/index.html":
            self.path = "/src/static/index.html"
        elif self.path == "/favicon.ico":
            self.path = "/src/static/assets/favicon.png"
        elif self.path.startswith(("/css/", "/js/", "/img/", "/assets/")):
            self.path = "/src/static" + self.path
        elif self.path.startswith("/static/"):
            self.path = "/src" + self.path

        try:
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        except ConnectionAbortedError:
            pass

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == "/api/run":
            self._trigger_run()
            return
        if parsed_path.path == "/api/repos":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                repo_data = json.loads(body)
                database.add_repo(repo_data)
                self._set_headers(201)
                self.wfile.write(b'{"status": "created"}')
            except Exception as e:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        if parsed_path.path == "/api/repos/toggle":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                database.toggle_repo(data["id"])
                self._set_headers(200)
                self.wfile.write(b'{"status": "toggled"}')
            except Exception as e:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        self._set_headers(404)

    def do_DELETE(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == "/api/repos":
            query = urllib.parse.parse_qs(parsed_path.query)
            if "id" in query:
                repo_id = query["id"][0]
                database.delete_repo(repo_id)
                self._set_headers(200)
                self.wfile.write(b'{"status": "deleted"}')
                return
        self._set_headers(404)

    def _trigger_run(self):
        if not state.data["running"]:
            if trigger_scan_callback:
                threading.Thread(target=trigger_scan_callback).start()
            self._set_headers(200)
            self.wfile.write(b'{"status": "started"}')
        else:
            self._set_headers(409)
            self.wfile.write(b'{"status": "already_running"}')
