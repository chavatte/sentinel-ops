import http.server
import json
import threading
import os
from state import state

trigger_scan_callback = None

class SentinelHandler(http.server.SimpleHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/status'):
            self._set_headers()
            with state.lock: self.wfile.write(json.dumps(state.data).encode())
            return
        
        if self.path == '/api/run':
            self._trigger_run()
            return

        if self.path == '/' or self.path == '/index.html':
            self.path = '/src/static/index.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        
        elif self.path.startswith(('/css/', '/js/', '/img/', '/assets/')):
            self.path = '/src/static' + self.path
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
            
        elif self.path.startswith('/static/'):
            self.path = '/src' + self.path
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
            
        else:
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if self.path == '/api/run':
            self._trigger_run()
        else:
            self._set_headers(404)

    def _trigger_run(self):
        if not state.data['running']:
            if trigger_scan_callback:
                threading.Thread(target=trigger_scan_callback).start()
            self._set_headers(200)
            self.wfile.write(b'{"status": "started"}')
        else:
            self._set_headers(409)
            self.wfile.write(b'{"status": "already_running"}')