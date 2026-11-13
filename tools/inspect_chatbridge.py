#!/usr/bin/env python3
"""GET-only inspection of a separately installed local Puppy GUI.

This intentionally cannot submit prompts, open a WebSocket, approve tools,
change sessions, or modify any Code Puppy files.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

CHECKED_PATHS = (
    "/api/health",
    "/api/agents",
    "/api/models",
    "/api/sessions/active",
)
MAX_SCHEMA_BYTES = 262144


class RefuseRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def validated_origin(value: str) -> str:
    parsed = urlparse(value)
    if (
        parsed.scheme != "http"
        or parsed.hostname != "127.0.0.1"
        or not parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in ("", "/")
        or parsed.params or parsed.query or parsed.fragment
    ):
        raise ValueError("Only an exact http://127.0.0.1:PORT origin is allowed")
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError("Invalid loopback port") from error
    if port is None or not 1 <= port <= 65535:
        raise ValueError("A valid explicit port is required")
    return f"http://127.0.0.1:{port}"


def checked_source(gui_root: Path | None) -> dict[str, bool | str]:
    if gui_root is None:
        return {"state": "not_checked"}
    root = gui_root.expanduser()
    nested = root / "code_puppy_gui"
    return {
        "state": "files_checked_only",
        "launcher_present": (root / "launch_gui.py").is_file(),
        "app_module_present": (nested / "app.py").is_file(),
        "chat_route_source_present": (nested / "api" / "routes_chat.py").is_file(),
        "client_chat_js_present": (nested / "static" / "js" / "chat.js").is_file(),
    }


def inspect(origin: str, gui_root: Path | None = None, *, offline: bool = False) -> dict:
    host = validated_origin(origin)
    report: dict = {
        "origin": host,
        "source": checked_source(gui_root),
        "health": {"available": False, "status": None},
        "rest_routes": {"schema_available": False, "presence": {path: False for path in CHECKED_PATHS}},
        "websocket_chat": "NOT CHECKED: GET-only inspection cannot verify chat WebSocket, session ownership or approvals",
        "safety": "No prompts, WebSockets, session writes or Code Puppy files were changed by this inspector.",
    }
    if offline:
        report["health"]["status"] = "not_checked"
        return report

    opener = build_opener(ProxyHandler({}), RefuseRedirect())

    def request(path: str, *, read_schema: bool) -> tuple[int | None, bytes | None]:
        req = Request(host + path, method="GET", headers={"Accept": "application/json"})
        try:
            with opener.open(req, timeout=2) as response:
                status = response.status
                if not read_schema:
                    return status, None
                data = response.read(MAX_SCHEMA_BYTES + 1)
                return status, data if len(data) <= MAX_SCHEMA_BYTES else None
        except HTTPError as error:
            return error.code, None
        except (URLError, TimeoutError, OSError):
            return None, None

    status, _ = request("/api/health", read_schema=False)
    report["health"] = {"available": status is not None and 200 <= status < 300, "status": status}

    schema_status, schema_body = request("/openapi.json", read_schema=True)
    report["rest_routes"]["schema_http_status"] = schema_status
    if schema_status == 200 and schema_body is not None:
        try:
            schema = json.loads(schema_body)
            paths = schema.get("paths") if isinstance(schema, dict) else None
            if isinstance(paths, dict):
                report["rest_routes"]["schema_available"] = True
                report["rest_routes"]["presence"] = {
                    path: path in paths and isinstance(paths[path], dict)
                    for path in CHECKED_PATHS
                }
        except (ValueError, UnicodeError):
            pass
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", default="http://127.0.0.1:8765", help="Loopback GUI origin only")
    parser.add_argument("--gui-root", type=Path, help="Optional path to existing puppy_gui checkout (read-only)")
    parser.add_argument("--offline", action="store_true", help="Inspect source presence only, no HTTP requests")
    args = parser.parse_args(argv)
    try:
        report = inspect(args.origin, args.gui_root, offline=args.offline)
    except ValueError as error:
        print(f"Inspection refused: {error}", file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
