#!/usr/bin/env python3
"""Check the running, sandboxed app without printing credentials or activity."""
import http.client
import json
from pathlib import Path

credential = Path.home() / "Library/Containers/com.timeowilliams.DeepFocusNative/Data/Library/Application Support/DeepFocusNative/pairing-token"
token = credential.read_text().strip()

def request(method, path, body=None, authorized=True, extra=None):
    connection = http.client.HTTPConnection("127.0.0.1", 17322, timeout=3)
    headers = {"Authorization": "Bearer " + token} if authorized else {}
    if body is not None:
        headers["Content-Type"] = "application/json"
    headers.update(extra or {})
    connection.request(method, path, body=json.dumps(body) if body is not None else None, headers=headers)
    response = connection.getresponse()
    data = response.read()
    code = response.status
    connection.close()
    return code, data

code, payload = request("GET", "/v1/status")
assert code == 200, "Authenticated status failed"
state = json.loads(payload)
assert "epoch" in state and "monitoring" in state
checks = [
    ("Missing credential", request("GET", "/v1/status", authorized=False)[0], 401),
    ("Malformed event", request("POST", "/v1/event", {})[0], 400),
    ("Webpage origin", request("GET", "/v1/status", extra={"Origin": "https://example.com"})[0], 401),
    ("Extension origin", request("GET", "/v1/status", extra={"Origin": "chrome-extension://abcdefghijklmnop"})[0], 200),
    ("Unknown route", request("GET", "/unknown")[0], 404),
    ("Stale event", request("POST", "/v1/event", dict(browser="chrome", epoch="obsolete", sequence=1,
     observedAt=0, focused=True, privateBrowsing=False, url="https://example.com"))[0], 409),
]
for name, actual, expected in checks:
    assert actual == expected, f"{name}: HTTP {actual} instead of {expected}"
    print(f"{name}: PASS")
print("Authenticated loopback bridge: PASS (no credential or activity printed)")
