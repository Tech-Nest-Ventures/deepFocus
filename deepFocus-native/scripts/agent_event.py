#!/usr/bin/env python3
"""Write one explicit local agent lifecycle event. Never scans tasks or invokes an agent."""
import argparse
import json
import os
from pathlib import Path
import tempfile
import time
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--device-id', type=uuid.UUID, required=True)
    parser.add_argument('--task', required=True)
    parser.add_argument('--run', required=True)
    parser.add_argument('--kind', choices=['started', 'finished', 'reviewed', 'accepted'], required=True)
    parser.add_argument('--label', required=True)
    parser.add_argument('--event-id', default=None, help='Reuse the same ID to retry the same event')
    parser.add_argument('--timestamp-ms', type=int, default=None)
    parser.add_argument('--result-reference')
    args = parser.parse_args()
    for value in [args.source, args.task, args.run, args.event_id or 'generated']:
        if not value or len(value) > 512:
            parser.error('Identifiers must contain 1–512 characters')
    if len(args.label) > 120 or len(args.result_reference or '') > 2048:
        parser.error('Label must be <=120 and result reference <=2048 characters')
    event = dict(sourceID=args.source, eventID=args.event_id or str(uuid.uuid4()),
                 taskID=args.task, runID=args.run, deviceID=str(args.device_id),
                 timestamp=args.timestamp_ms if args.timestamp_ms is not None else int(time.time() * 1000),
                 kind=args.kind, label=args.label)
    if args.result_reference is not None:
        event['resultReference'] = args.result_reference
    if args.output.exists():
        if args.output.stat().st_size > 5_000_000:
            parser.error('Event file exceeds 5 MB; start a new file')
        payload = json.loads(args.output.read_text())
        if payload.get('schemaVersion') != 1 or not isinstance(payload.get('events'), list):
            parser.error('Unsupported event file; existing file preserved')
    else:
        payload = dict(schemaVersion=1, events=[])
    for existing in payload['events']:
        if (existing.get('deviceID'), existing.get('sourceID'), existing.get('eventID')) == (event['deviceID'], event['sourceID'], event['eventID']):
            if existing != event:
                parser.error('Conflicting event ID; existing file preserved. A retry must reuse the timestamp too.')
            return
    payload['events'].append(event)
    data = json.dumps(payload, indent=2) + '\n'
    if len(data.encode()) > 5_000_000:
        parser.error('Event file exceeds 5 MB; start a new file')
    # Serialize writers with an exclusive lock file; never drop a concurrent writer's events.
    lock = args.output.with_name(args.output.name + '.lock')
    try:
        lock_fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        parser.error('Another writer is active; retry after it completes')
    try:
        # Detect modifications since the initial read while holding our writer lock.
        if args.output.exists():
            current = json.loads(args.output.read_text())
            if current != dict(schemaVersion=1, events=payload['events'][:-1]):
                parser.error('File changed while preparing event; retry')
        with tempfile.NamedTemporaryFile(mode='w', dir=args.output.parent, delete=False) as temporary:
            temporary.write(data)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        try:
            os.chmod(temporary_path, 0o600)
            os.replace(temporary_path, args.output)
        finally:
            temporary_path.unlink(missing_ok=True)
    finally:
        os.close(lock_fd)
        lock.unlink(missing_ok=True)
    print('Local event saved. Import this file in Deep Focus → Today’s timeline → Import agent events.')


if __name__ == '__main__':
    main()
