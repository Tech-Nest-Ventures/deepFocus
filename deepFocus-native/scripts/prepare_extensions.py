#!/usr/bin/env python3
"""Build browser-specific manifests around shared source. No Node or packages required."""
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
for browser in ("chromium", "safari"):
    output = root / "Browser" / browser
    output.mkdir(parents=True, exist_ok=True)
    for source in (root / "Browser" / "shared").iterdir():
        if source.is_file():
            destination = output / source.name
            if not destination.exists() or source.read_bytes() != destination.read_bytes():
                shutil.copyfile(source, destination)
    manifest = {
        "manifest_version": 3,
        "name": "Deep Focus Browser Monitor",
        "version": "0.1.0",
        "description": "Show your active public tab in Deep Focus on this Mac. The extension saves no URL history.",
        "permissions": ["tabs", "storage", "alarms"],
        "host_permissions": ["http://127.0.0.1/*"],
        "action": {"default_title": "Deep Focus", "default_popup": "popup.html"},
        "background": {"service_worker": "background.js"} if browser == "chromium"
            else {"scripts": ["background.js"], "persistent": False},
        "content_security_policy": {"extension_pages": "script-src 'self'; object-src 'none'; connect-src http://127.0.0.1:17322"},
    }
    if browser == "chromium":
        manifest["minimum_chrome_version"] = "120"
        manifest["incognito"] = "not_allowed"
    else:
        # Safari gates Tab.url on website access even with the tabs permission.
        # Ask explicitly from the popup, rather than collecting permissions at install time.
        manifest["optional_host_permissions"] = ["http://*/*", "https://*/*"]
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
