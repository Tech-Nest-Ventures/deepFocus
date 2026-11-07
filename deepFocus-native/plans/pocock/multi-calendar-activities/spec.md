# Multi-account calendars and concurrent activities

User-approved increment, November 7, 2026. Preserve the frozen charter.

## Outcome
One agenda combines selected calendars from multiple Google accounts on Mac and iPhone. Use EventKit and existing system accounts; Notion Calendar sees the same provider calendars. No direct Notion database adapter or Google OAuth backend. Entry annotations allow concurrent categories without inflating wall-clock time.

## Vertical slices
1. Concurrent confirmation: normalized categories, exclusive unknown, partial corrections, v3 archives/exchange with exact v1/v2 backups, Mac/phone selection UI.
2. Connected intentions: explicit permission and selection, account labels/aliases, bounded daily agenda, calendar/occurrence identity, conflicts/staleness/deletion clearing, preservation of unrelated evidence.
3. Explicit publication: preview confirmed labels/times only; existing writable Actuals destination; immutable ownership verification and identifier receipts; no automatic edits or deletes. Publish from one device pending reconciliation.
4. Integration: native sandbox permission/configuration, builds, synthetic permission/policy/persistence probes, independent review, setup documentation, deliverable refresh.

Dependencies: 3 depends on 1 and 2; 4 verifies all slices. Implementation dispatched in parallel to multi_activity, calendar_policy and calendar_adapter; parent owns UI/wiring/build/delivery.

## Acceptance and boundaries
Empty selection reads no events. Startup, deselection, disconnect and revoked access clear stale local intentions. Accounts remain device-local. Calendar events do not prove activity. No private ledger auto-sync, account credentials, backend, analytics, URL/location publication or personal-account changes in automated tests. Real multi-account/provider sync remains an explicit live validation gate.
