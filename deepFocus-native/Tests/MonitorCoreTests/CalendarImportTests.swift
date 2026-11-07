import XCTest
@testable import MonitorCore

final class CalendarImportTests: XCTestCase {
    let device = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!
    func date(_ value: String) -> Date { ISO8601DateFormatter().date(from: value)! }
    func snapshot(_ events: [[String: Any]], fetched: String = "2026-11-07T20:00:00Z") throws -> Data {
        try JSONSerialization.data(withJSONObject: ["source": "test-calendar", "fetched_at": fetched,
            "range": ["start": "2026-11-01", "end": "2026-11-08"], "events": events])
    }
    func event(_ changes: [String: Any] = [:]) -> [String: Any] {
        var result: [String: Any] = ["id": "appointment-1", "calendarName": "Test calendar", "summary": "Planned reading",
            "start": "2026-11-07T09:00:00", "end": "2026-11-07T10:00:00"]
        result.merge(changes) { _, new in new }
        return result
    }

    func testImportPreservesIntentionAndUsesNewYorkForOffsetlessTimes() throws {
        let items = try CalendarImport.decode(snapshot([event()]), deviceID: device)
        let item = try XCTUnwrap(items.first)
        XCTAssertEqual(item.start, date("2026-11-07T14:00:00Z"))
        XCTAssertEqual(item.end, date("2026-11-07T15:00:00Z"))
        XCTAssertEqual(item.calendar?.timeZoneID, "America/New_York")
        XCTAssertEqual(item.calendar?.calendarID, "Test calendar")
        var ledger = TimelineLedger(startedAt: date("2026-11-07T00:00:00Z"))
        try ledger.addEvidence(item)
        XCTAssertTrue(ledger.intervals.isEmpty)
        XCTAssertTrue(ledger.annotations.isEmpty)
        XCTAssertEqual(ledger.evidence.count, 1)
    }
    func testNewerEventUpdatesWinOverRepeatedOrStaleSnapshots() throws {
        let original = try CalendarImport.decode(snapshot([event(["updated": "2026-11-06T20:00:00Z"])]), deviceID: device)
        let newer = try CalendarImport.decode(snapshot([event(["summary": "Revised plan", "updated": "2026-11-07T20:00:00Z"])]), deviceID: device)
        let stale = try CalendarImport.decode(snapshot([event(["summary": "Old plan", "updated": "2026-11-06T20:00:00Z"])],
            fetched: "2026-11-08T20:00:00Z"), deviceID: device)
        var ledger = TimelineLedger(startedAt: date("2026-11-01T00:00:00Z"))
        for item in original + newer + newer + stale { try ledger.addEvidence(item) }
        XCTAssertEqual(ledger.evidence.count, 1)
        XCTAssertEqual(ledger.evidence[0].label, "Revised plan")
        XCTAssertEqual(ledger.evidence[0].id, original[0].id)
    }
    func testCancellationWithoutDatesUsesPriorEvidenceAndCannotBeResurrectedByOldSnapshot() throws {
        let original = try CalendarImport.decode(snapshot([event()], fetched: "2026-11-06T20:00:00Z"), deviceID: device)
        let cancelled: [String: Any] = ["id": "appointment-1", "calendarName": "Test calendar", "status": "cancelled"]
        let update = try CalendarImport.decode(snapshot([cancelled]), deviceID: device, existingEvidence: original)
        XCTAssertTrue(try XCTUnwrap(update[0].calendar).cancelled)
        XCTAssertEqual(update[0].start, original[0].start)
        XCTAssertEqual(update[0].id, original[0].id)
        var ledger = TimelineLedger(startedAt: date("2026-11-01T00:00:00Z"))
        for item in original + update + original { try ledger.addEvidence(item) }
        XCTAssertEqual(ledger.evidence.count, 1)
        XCTAssertEqual(ledger.evidence[0].calendar?.cancelled, true)
        XCTAssertThrowsError(try CalendarImport.decode(snapshot([cancelled]), deviceID: device))
        XCTAssertEqual(try CalendarImport.decode(snapshot([]), deviceID: device, existingEvidence: original).count, 0)
    }
    func testRecurringMovedOccurrenceKeepsOriginalIdentityAndItsTimeZone() throws {
        let first = event(["recurring_event_id": "weekly-series", "originalStartTime": ["dateTime": "2026-11-07T09:00:00-05:00"],
            "start": ["dateTime": "2026-11-07T09:00:00-05:00", "timeZone": "America/New_York"],
            "end": ["dateTime": "2026-11-07T10:00:00-05:00", "timeZone": "America/New_York"]])
        var moved = first
        moved["start"] = ["dateTime": "2026-11-07T11:00:00-05:00", "timeZone": "America/New_York"]
        moved["end"] = ["dateTime": "2026-11-07T12:00:00-05:00", "timeZone": "America/New_York"]
        let original = try CalendarImport.decode(snapshot([first], fetched: "2026-11-06T20:00:00Z"), deviceID: device)
        let update = try CalendarImport.decode(snapshot([moved]), deviceID: device, existingEvidence: original)
        XCTAssertEqual(original[0].id, update[0].id)
        XCTAssertEqual(update[0].calendar?.eventID, "weekly-series")
        XCTAssertEqual(update[0].calendar?.timeZoneID, "America/New_York")
        XCTAssertEqual(update[0].start, date("2026-11-07T16:00:00Z"))
        var cancelled = first
        cancelled.removeValue(forKey: "start"); cancelled.removeValue(forKey: "end")
        cancelled["status"] = "cancelled"
        let tombstone = try CalendarImport.decode(snapshot([cancelled]), deviceID: device, existingEvidence: update)
        XCTAssertEqual(tombstone[0].id, original[0].id)
        XCTAssertEqual(tombstone[0].calendar?.cancelled, true)
    }
    func testDSTRequiresExplicitOffsetsForRepeatedOrNonexistentLocalTimes() throws {
        for start in ["2026-11-01T01:30:00", "2026-03-08T02:30:00"] {
            XCTAssertThrowsError(try CalendarImport.decode(snapshot([event(["start": start,
                "end": String(start.prefix(10)) + "T04:00:00"])]), deviceID: device))
        }
        let repeated = try CalendarImport.decode(snapshot([event(["start": "2026-11-01T01:30:00-04:00",
            "end": "2026-11-01T01:30:00-05:00"])]), deviceID: device)
        XCTAssertEqual(repeated[0].end!.timeIntervalSince(repeated[0].start), 3600)
        let summer = try CalendarImport.decode(snapshot([event(["start": "2026-07-01T09:00:00",
            "end": "2026-07-01T10:00:00"])]), deviceID: device)
        XCTAssertEqual(summer[0].start, date("2026-07-01T13:00:00Z"))
    }
    func testReviewSuggestionsExcludeCancelledAllDayAndTouchingBoundaries() throws {
        let items = try CalendarImport.decode(snapshot([
            event(),
            event(["id": "all-day", "start": ["date": "2026-11-01"], "end": ["date": "2026-11-02"]]),
            event(["id": "cancelled", "status": "cancelled"]),
            event(["id": "later", "start": "2026-11-07T10:00:00", "end": "2026-11-07T11:00:00"])
        ]), deviceID: device)
        let allDay = try XCTUnwrap(items.first { $0.calendar?.eventID == "all-day" })
        XCTAssertEqual(allDay.calendar?.isAllDay, true)
        XCTAssertEqual(allDay.end!.timeIntervalSince(allDay.start), 25 * 3600)
        let range = DateInterval(start: date("2026-11-07T14:00:00Z"), end: date("2026-11-07T15:00:00Z"))
        let suggestions = CalendarImport.suggestions(in: range, evidence: items)
        XCTAssertEqual(suggestions.map { $0.calendar?.eventID }, ["appointment-1"])
    }
    func testDuplicateRecordsCollapseAndConflictingSameVersionFails() throws {
        let repeated = try CalendarImport.decode(snapshot([event(), event()]), deviceID: device)
        XCTAssertEqual(repeated.count, 1)
        XCTAssertThrowsError(try CalendarImport.decode(snapshot([event(), event(["summary": "Conflicting title"])]), deviceID: device))
        var noID = event(); noID.removeValue(forKey: "id")
        let first = try CalendarImport.decode(snapshot([noID]), deviceID: device)
        let second = try CalendarImport.decode(snapshot([noID]), deviceID: UUID())
        XCTAssertEqual(first[0].id, second[0].id)
        var renamed = noID; renamed["summary"] = "Renamed plan"
        XCTAssertNotEqual(first[0].id, try CalendarImport.decode(snapshot([renamed]), deviceID: device)[0].id)
    }
    func testInvalidRangesAndMixedAllDayFormatsFailWithoutPartialImport() throws {
        for changes: [String: Any] in [
            ["start": "2026-11-07", "end": "2026-11-08T00:00:00"],
            ["start": "2026-02-30", "end": "2026-03-01"],
            ["timeZone": "Unknown/Zone"],
            ["start": "2026-11-07T11:00:00"],
            ["updated": "not-a-date"]
        ] {
            XCTAssertThrowsError(try CalendarImport.decode(snapshot([event(changes)]), deviceID: device))
        }
        let prior = try CalendarImport.decode(snapshot([event()]), deviceID: device)
        XCTAssertThrowsError(try CalendarImport.decode(snapshot([["calendarName": "Test calendar", "id": "appointment-1",
            "status": "cancelled", "start": [:], "end": [:]]]), deviceID: device, existingEvidence: prior))
    }
}
