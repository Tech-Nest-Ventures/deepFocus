import XCTest
@testable import MonitorCore

final class EvidenceVersionTests: XCTestCase {
    let instant = Date(timeIntervalSince1970: 1_800_000_000)

    func calendar(updated: Double, cancelled: Bool = false) -> ContextEvidence {
        ContextEvidence(id: UUID(), deviceID: UUID(), source: .calendar, start: instant,
            end: instant.addingTimeInterval(3600), recordedAt: instant, label: "Intention",
            coarseLatitude: nil, coarseLongitude: nil, uncertaintyMeters: nil,
            calendar: CalendarEvidenceMetadata(sourceID: "fixture", calendarID: "work", eventID: "a",
                occurrenceID: "a", updatedAt: instant.addingTimeInterval(updated),
                timeZoneID: "America/New_York", isAllDay: false, cancelled: cancelled))
    }

    func testV1ArchiveLoadsAndNextExportWritesV2() throws {
        let encoded = try TimelineArchive.encode(TimelineLedger(startedAt: instant))
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        object["schemaVersion"] = 1
        let restored = try TimelineArchive.decode(JSONSerialization.data(withJSONObject: object))
        XCTAssertEqual(restored.schemaVersion, 1)
        let next = try XCTUnwrap(JSONSerialization.jsonObject(with: TimelineArchive.encode(restored)) as? [String: Any])
        XCTAssertEqual(next["schemaVersion"] as? Int, 2)
    }

    func testCalendarUpdateCancellationAndStaleImportDoNotInventHumanTime() throws {
        var ledger = TimelineLedger(startedAt: instant)
        try ledger.addEvidence(calendar(updated: 1))
        try ledger.addEvidence(calendar(updated: 2, cancelled: true))
        try ledger.addEvidence(calendar(updated: 0))
        XCTAssertEqual(ledger.evidence.count, 1)
        XCTAssertEqual(ledger.evidence.first?.calendar?.cancelled, true)
        XCTAssertTrue(ledger.intervals.isEmpty)
        XCTAssertTrue(ledger.annotations.isEmpty)
        let exchange = try TimelineExchange.decode(TimelineExchange(annotations: [], evidence: ledger.evidence).encode())
        var imported = TimelineLedger(startedAt: instant)
        try exchange.merge(into: &imported)
        try exchange.merge(into: &imported)
        XCTAssertEqual(imported.evidence.count, 1)
        XCTAssertEqual(imported.evidence.first?.calendar, ledger.evidence.first?.calendar)
    }

    func testBadMetadataRejectedBeforeImport() throws {
        var item = calendar(updated: 0)
        item.agent = AgentEventMetadata(sourceID: "test", eventID: "1", taskID: "task", runID: "run", kind: .started, resultReference: nil)
        var ledger = TimelineLedger()
        XCTAssertThrowsError(try ledger.addEvidence(item))
        XCTAssertThrowsError(try TimelineExchange(annotations: [], evidence: [item]).encode())
    }

    func testFutureVersionDoesNotDecode() throws {
        let data = try TimelineArchive.encode(TimelineLedger())
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        object["schemaVersion"] = 99
        XCTAssertThrowsError(try TimelineArchive.decode(JSONSerialization.data(withJSONObject: object)))
    }
}
