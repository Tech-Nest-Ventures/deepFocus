# Local calendar intentions

Use **Import calendar** in Deep Focus to choose an exported JSON file. Import is explicit and local; it does not connect an account, fetch a calendar, or import the repository's existing personal snapshot automatically. Calendar labels and times become local context evidence. They never create tracked human time or confirm that a planned activity happened.

The snapshot accepts the existing envelope shape:

```json
{
  "source": "my-calendar-export",
  "fetched_at": "2026-11-07T20:00:00Z",
  "range": { "start": "2026-11-01", "end": "2026-11-08" },
  "events": [
    {
      "id": "stable-event-id",
      "calendarID": "stable-calendar-id",
      "calendarName": "Personal",
      "summary": "Planned reading",
      "start": "2026-11-07T09:00:00-05:00",
      "end": "2026-11-07T10:00:00-05:00",
      "updated": "2026-11-07T19:00:00Z"
    }
  ]
}
```

Files must be no larger than 5 MB. Invalid events reject the whole import with a row number; callers must finish decoding before saving anything. `range` is descriptive and does not imply that missing events were deleted. Unused fields such as location, attendees, and descriptions are not imported. Labels are capped at 120 characters.

## Time interpretation

- Explicit ISO 8601 offsets determine the actual instant, including daylight-saving transitions. Offsetless `YYYY-MM-DDTHH:mm:ss` uses the event's `timeZone` or `America/New_York` by default. The decoder can receive a different default time zone.
- Provider objects such as `{"dateTime":"2026-11-07T09:00:00-05:00","timeZone":"America/New_York"}` and `{"date":"2026-11-07"}` are accepted for start/end. All-day entries require date-only start and **exclusive** end dates; a local day may be 23 or 25 hours.
- Ambiguous repeated local times and nonexistent spring-forward local times are rejected. Export an explicit offset to resolve them. Malformed dates, unknown time zones, and empty/reversed ranges are rejected.
- Review suggestions include only timed, noncancelled events that overlap a selected interval. All-day entries remain context but are not offered as evidence for a specific time gap. A suggestion is an intention that still needs user review.

## Identity, updates, and cancellation

Prefer stable calendar IDs (`calendarID`, `calendarId`, or `calendar_id`) and provider event IDs (`id`, `eventID`, or `eventId`). `calendarName` is accepted when no calendar ID exists, but renaming that calendar changes its identity.

Recurring entries use `recurring_event_id` / `recurringEventId` as their series ID. Their occurrence identity comes from `originalStartTime`, `originalStart`, or `occurrence.originalStart` when present, otherwise the provider instance ID, otherwise the start text. Preserve the same identity fields across exports; adding previously missing recurrence metadata can create a second identity. Moving an occurrence with an original-start identity updates that occurrence rather than creating a new one.

When no event ID exists, a deterministic fingerprint uses source, calendar, start, end, and summary. Reimporting unchanged records is safe, but edits to those fields produce another record: identity cannot be recovered from data the export omitted. Prefer a provider export with stable IDs.

The provider's `updated` / `updated_at` timestamp wins; if absent, `fetched_at` is the snapshot version. The timeline retains the newest version. Repeated imports do not duplicate evidence, old snapshots do not overwrite newer versions, and conflicting versions with the same timestamp within a file are rejected. Snapshot time is only a fallback and cannot establish whether an upstream provider returned stale content.

`status: "cancelled"` or `cancelled: true` records a cancellation tombstone. A cancellation without dates must match previously imported source/calendar/event/occurrence evidence, or decoding fails clearly; it never invents an interval. Missing rows are never treated as cancellations. Old snapshots cannot resurrect a newer cancellation.

## Integration seam

```swift
CalendarImport.decode(
    _ data: Data,
    deviceID: UUID,
    existingEvidence: [ContextEvidence] = [],
    defaultTimeZone: TimeZone = TimeZone(identifier: "America/New_York")!
) throws -> [ContextEvidence]

CalendarImport.suggestions(
    in range: DateInterval,
    evidence: [ContextEvidence]
) -> [ContextEvidence]
```

Decode fully, then add returned evidence through `TimelineLedger.addEvidence`. Pass existing ledger evidence so date-less cancellations can resolve their prior interval. Render suggestions as calendar intentions, and require an explicit user correction/confirmation before creating a timeline annotation.
