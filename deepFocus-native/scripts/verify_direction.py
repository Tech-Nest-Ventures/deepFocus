#!/usr/bin/env python3
"""Guard the frozen approved product direction against accidental edits."""
import hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[1]
charter = root / "docs/product-direction/2026-11-06-v1.md"
expected = (charter.parent / "2026-11-06-v1.sha256").read_text().split()[0]
actual = hashlib.sha256(charter.read_bytes()).hexdigest()
if actual != expected:
    raise SystemExit("Frozen product direction changed. Restore v1; obtain approval for a new amendment instead.")
print("Approved product direction v1: checksum verified.")
