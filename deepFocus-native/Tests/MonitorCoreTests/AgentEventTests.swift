import XCTest
@testable import MonitorCore

final class AgentEventTests: XCTestCase {
    let device = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
    func event(_ id: String, _ kind: AgentEventMetadata.Kind, _ seconds: Double, run: String = "run") -> AgentFileEvent {
        AgentFileEvent(sourceID: "fixture", eventID: id, taskID: "task", runID: run,
            deviceID: device, timestamp: Date(timeIntervalSince1970: 1_800_000_000 + seconds),
            kind: kind, label: "Build sample", resultReference: nil)
    }
    func testOutOfOrderEventsShowMachineDurationAndDoNotCreateHumanTime() throws {
        let file = AgentEventFile(events: [event("finish", .finished, 120), event("start", .started, 0), event("accept", .accepted, 130)])
        var ledger = TimelineLedger()
        for evidence in try AgentEventFile.decode(file.encode()) { try ledger.addEvidence(evidence) }
        let runs = AgentRunSummary.summaries(in: ledger.evidence)
        XCTAssertEqual(runs.count, 1)
        XCTAssertEqual(runs[0].runtime, 120)
        XCTAssertTrue(runs[0].accepted)
        XCTAssertTrue(ledger.intervals.isEmpty)
        XCTAssertTrue(ledger.annotations.isEmpty)
    }
    func testDuplicateImportIsIdempotentAndIncompleteOrConflictingRunsHaveNoDuration() throws {
        var ledger = TimelineLedger()
        let evidence = try AgentEventFile.decode(AgentEventFile(events: [event("finish", .finished, 60)]).encode())
        for _ in 0..<2 { for item in evidence { try ledger.addEvidence(item) } }
        XCTAssertEqual(ledger.evidence.count, 1)
        XCTAssertNil(AgentRunSummary.summaries(in: ledger.evidence)[0].runtime)
        for item in try AgentEventFile.decode(AgentEventFile(events: [event("start", .started, 0), event("again", .started, 10)]).encode()) {
            try ledger.addEvidence(item)
        }
        XCTAssertNil(AgentRunSummary.summaries(in: ledger.evidence)[0].runtime)
    }
    func testConflictingEventIDsAndFutureFormatsAreRejected() throws {
        XCTAssertThrowsError(try AgentEventFile.decode(AgentEventFile(events: [event("same", .started, 0), event("same", .finished, 60)]).encode()))
        var future = AgentEventFile(events: [])
        future.schemaVersion = 99
        XCTAssertThrowsError(try AgentEventFile.decode(future.encode()))
    }

    func testConflictingExchangeDoesNotPartiallyMergeTagsOrEvidence() throws {
        var ledger = TimelineLedger()
        try ledger.addEvidence(event("same", .started, 0).observation)
        let annotation = ActivityAnnotation(id: UUID(), deviceID: device,
            start: Date(timeIntervalSince1970: 100), end: Date(timeIntervalSince1970: 200),
            category: .review, recordedAt: Date(timeIntervalSince1970: 300))
        let exchange = TimelineExchange(annotations: [annotation], evidence: [event("same", .finished, 60).observation])
        XCTAssertThrowsError(try exchange.merge(into: &ledger))
        XCTAssertTrue(ledger.annotations.isEmpty)
        XCTAssertEqual(ledger.evidence.count, 1)
        XCTAssertEqual(ledger.evidence[0].agent?.kind, .started)
    }

    func testExtremeImportedRuntimeIsUnavailableInsteadOfOverflowingDisplay() {
        let events = [event("start", .started, 0).observation, event("finish", .finished, 1e30).observation]
        XCTAssertNil(AgentRunSummary.summaries(in: events)[0].runtime)
    }
}
