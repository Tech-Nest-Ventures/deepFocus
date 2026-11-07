# Local agent events

Agent execution is a separate machine axis. Importing events does not create observed or confirmed human time. This milestone has no Codex/Claude hooks, network service, or automatic task scraping.

Use `python3 scripts/agent_event.py --help` to write explicit events. Choose a stable device UUID once (`uuidgen`), source name, task ID and run ID. Each new execution gets a new run ID. Supported kinds are `started`, `finished`, `reviewed`, `accepted`; reviews/acceptance describe imported events and do not certify output quality.

Example (synthetic IDs):

```sh
python3 scripts/agent_event.py --output /tmp/example-events.json \
  --source manual --device-id 00000000-0000-0000-0000-000000000001 \
  --task example --run example-1 --kind started --label 'Example build'
```

Run it again with `--kind finished` when finished. Optional `--result-reference` stores a short user-supplied reference as text, without opening or fetching it. Do not include credentials. To retry an identical event, reuse both `--event-id` and `--timestamp-ms`.

In the Mac app, open Today's timeline → Import agent events. The explicit JSON file uses `schemaVersion: 1`, `events: [...]`, and fields `sourceID`, `eventID`, `taskID`, `runID`, `deviceID` (UUID), `timestamp` (Unix milliseconds), `kind`, `label`, optional `resultReference`. Files are limited to 5 MB. The writer uses owner-only files and an exclusive lock; if interrupted, inspect and remove its stale `.lock` file before retrying.

Events can arrive out of order. Exact repeats are idempotent; conflicting event IDs reject the import atomically. A runtime requires exactly one start and one finish in chronological order for the same source/device/task/run. Missing or conflicting lifecycle boundaries show runtime unavailable. Concurrent runs are displayed separately and never added to human hours. There is no inference that a review or acceptance timestamp represents a person's duration.

Native archives and cross-device evidence exports use schema v2 to preserve typed provenance. V1 files remain readable; an original v1 local archive is copied to `.v1-backup` before migration. Corrupt/future archives and failed/conflicting backups disable writes rather than overwrite records. Older apps will reject v2 exports: update both devices before exchanging new evidence.
