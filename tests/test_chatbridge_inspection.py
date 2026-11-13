from __future__ import annotations

import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from tools.inspect_chatbridge import checked_source, inspect, validated_origin


class MockHandler(BaseHTTPRequestHandler):
    requests_seen: list[tuple[str, str]] = []
    redirect_schema = False

    def do_GET(self):
        type(self).requests_seen.append(("GET", self.path))
        if self.path == "/api/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        elif self.path == "/openapi.json":
            if type(self).redirect_schema:
                self.send_response(302)
                self.send_header("Location", "http://example.org/private")
                self.end_headers()
                return
            schema = {"paths": {
                "/api/health": {"get": {}},
                "/api/agents": {"get": {}},
                "/api/models": {"get": {}},
            }}
            body = json.dumps(schema).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        type(self).requests_seen.append(("POST", self.path))
        self.send_response(405)
        self.end_headers()

    def log_message(self, *_):
        pass


class InspectorTests(unittest.TestCase):
    def setUp(self):
        MockHandler.requests_seen = []
        MockHandler.redirect_schema = False
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), MockHandler)
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()
        self.origin = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(timeout=2)

    def test_two_get_only_probes_and_bounded_report(self):
        report = inspect(self.origin)
        self.assertEqual(MockHandler.requests_seen, [
            ("GET", "/api/health"), ("GET", "/openapi.json")
        ])
        self.assertTrue(report["health"]["available"])
        self.assertTrue(report["rest_routes"]["schema_available"])
        self.assertTrue(report["rest_routes"]["presence"]["/api/agents"])
        self.assertFalse(report["rest_routes"]["presence"]["/api/sessions/active"])
        self.assertNotIn("example.org", json.dumps(report))
        self.assertIn("NOT CHECKED", report["websocket_chat"])

    def test_no_network_for_offline_mode(self):
        report = inspect(self.origin, offline=True)
        self.assertEqual(MockHandler.requests_seen, [])
        self.assertEqual(report["health"]["status"], "not_checked")

    def test_redirects_not_followed(self):
        MockHandler.redirect_schema = True
        report = inspect(self.origin)
        self.assertFalse(report["rest_routes"]["schema_available"])
        self.assertEqual(report["rest_routes"]["schema_http_status"], 302)
        self.assertEqual(len(MockHandler.requests_seen), 2)

    def test_inspect_existing_source_files_does_not_write(self):
        with tempfile.TemporaryDirectory() as root:
            root_path = Path(root)
            nested = root_path / "code_puppy_gui" / "api"
            nested.mkdir(parents=True)
            (nested / "routes_chat.py").write_text("# source", encoding="utf-8")
            (root_path / "launch_gui.py").write_text("# launcher", encoding="utf-8")
            report = checked_source(root_path)
            self.assertTrue(report["chat_route_source_present"])
            self.assertTrue(report["launcher_present"])
            self.assertFalse(report["app_module_present"])
            self.assertEqual((nested / "routes_chat.py").read_text(), "# source")

    def test_only_explicit_ipv4_loopback_origin_allowed(self):
        for bad in [
            "https://127.0.0.1:8765", "http://localhost:8765",
            "http://127.0.0.1", "http://127.0.0.1:0",
            "http://127.0.0.1:70000", "http://user@127.0.0.1:8765",
            "http://127.0.0.1:8765/ws/chat", "http://127.0.0.1:8765/?x=1",
            "http://example.com:8765"
        ]:
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    validated_origin(bad)


if __name__ == "__main__":
    unittest.main()
