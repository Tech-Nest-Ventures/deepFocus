import XCTest
@testable import MonitorCore

final class MultiActivityTests: XCTestCase {
    let start = Date(timeIntervalSince1970: 1_800_000_000)
    func date(_ seconds: Double) -> Date { start.addingTimeInterval(seconds) }

    func testWalkingDuringCallCountsElapsedTimeOnceAndBothActivitiesFully() throws {
        var ledger = TimelineLedger(startedAt: start)
        try ledger.annotate(start: start, end: date(1800), categories: [.walking, .communication, .walking], now: date(1800))
        let range = DateInterval(start: start, end: date(1800))
        let slices = ledger.slices(in: range)
        XCTAssertEqual(slices.reduce(0) { $0 + $1.duration }, 1800)
        XCTAssertEqual(slices.first?.categories, [.communication, .walking])
        XCTAssertEqual(slices.first?.title, "Communication + Walking")
        XCTAssertEqual(ledger.categoryDurations(in: range)[.walking], 1800)
        XCTAssertEqual(ledger.categoryDurations(in: range)[.communication], 1800)
    }

    func testPartialCorrectionReplacesOnlyItsRegionAndKeepsWalkAcrossBothRegions() throws {
        var ledger = TimelineLedger(startedAt: start)
        try ledger.annotate(start: start, end: date(3600), categories: [.walking, .communication], now: date(3600))
        try ledger.annotate(start: date(1800), end: date(3600), categories: [.walking, .prayer], now: date(3601))
        let range = DateInterval(start: start, end: date(3600))
        XCTAssertEqual(ledger.slices(in: range).map(\.duration), [1800, 1800])
        XCTAssertEqual(ledger.slices(in: range).map(\.categories), [[.communication, .walking], [.walking, .prayer]])
        XCTAssertEqual(ledger.categoryDurations(in: range), [.walking: 3600, .communication: 1800, .prayer: 1800])
    }

    func testLegacySingleActivityArchivesAndExportsUpgradeWithoutLosingActivity() throws {
        for version in [1, 2] {
            let annotation: [String: Any] = ["id": UUID().uuidString, "deviceID": UUID().uuidString,
                "start": 1_800_000_000_000, "end": 1_800_000_060_000,
                "recordedAt": 1_800_000_070_000, "category": "walking"]
            let exchangeData = try JSONSerialization.data(withJSONObject: ["schemaVersion": version,
                "annotations": [annotation], "evidence": []])
            let exchange = try TimelineExchange.decode(exchangeData)
            XCTAssertEqual(exchange.annotations[0].categories, [.walking])
            let rewritten = try XCTUnwrap(JSONSerialization.jsonObject(with: exchange.encode()) as? [String: Any])
            XCTAssertEqual(rewritten["schemaVersion"] as? Int, 3)
            let rewrittenAnnotations = try XCTUnwrap(rewritten["annotations"] as? [[String: Any]])
            XCTAssertEqual(rewrittenAnnotations[0]["categories"] as? [String], ["walking"])
            XCTAssertNil(rewrittenAnnotations[0]["category"])
            let archive = try JSONSerialization.data(withJSONObject: ["schemaVersion": version,
                "deviceID": UUID().uuidString, "startedAt": 1_800_000_000_000, "intervals": [],
                "annotations": [annotation], "evidence": []])
            let ledger = try TimelineArchive.decode(archive)
            let current = try TimelineArchive.decode(TimelineArchive.encode(ledger))
            XCTAssertEqual(current.schemaVersion, 3)
            XCTAssertEqual(current.annotations[0].categories, [.walking])
        }
    }

    func testMalformedSelectionsCannotFallBackToLegacyCategoryAndUnknownIsExclusive() throws {
        var ledger = TimelineLedger(startedAt: start)
        for selection: [ActivityCategory] in [[], [.unknown, .walking]] {
            XCTAssertThrowsError(try ledger.annotate(start: start, end: date(60), categories: selection, now: date(60)))
        }
        XCTAssertTrue(ledger.annotations.isEmpty)
        try ledger.annotate(start: start, end: date(60), category: .unknown, now: date(60))
        XCTAssertEqual(ledger.slices(in: DateInterval(start: start, end: date(60))).first?.basis, .leftUnknown)
        XCTAssertTrue(ledger.categoryDurations(in: DateInterval(start: start, end: date(60))).isEmpty)
        for malformed: Any in [[], ["unknown", "walking"], ["unrecognized"], NSNull()] {
            let annotation: [String: Any] = ["id": UUID().uuidString, "deviceID": UUID().uuidString,
                "start": 1_800_000_000_000, "end": 1_800_000_060_000,
                "recordedAt": 1_800_000_070_000, "category": "walking", "categories": malformed]
            let data = try JSONSerialization.data(withJSONObject: ["schemaVersion": 3,
                "annotations": [annotation], "evidence": []])
            XCTAssertThrowsError(try TimelineExchange.decode(data))
        }
    }

    func testMultiActivityExchangeRoundTripsAndMergeOrderIsDeterministic() throws {
        let deviceID = UUID()
        let first = try ActivityAnnotation(id: XCTUnwrap(UUID(uuidString: "00000000-0000-0000-0000-000000000001")),
            deviceID: deviceID, start: start, end: date(1800), categories: [.walking, .communication], recordedAt: date(1801))
        let second = try ActivityAnnotation(id: XCTUnwrap(UUID(uuidString: "00000000-0000-0000-0000-000000000002")),
            deviceID: deviceID, start: start, end: date(1800), categories: [.prayer, .walking], recordedAt: date(1801))
        var forward = TimelineLedger(startedAt: start)
        var reverse = TimelineLedger(startedAt: start)
        for item in [first, second] {
            let exchange = try TimelineExchange.decode(TimelineExchange(annotations: [item], evidence: []).encode())
            try exchange.merge(into: &forward)
            try exchange.merge(into: &forward)
        }
        for item in [second, first] {
            try TimelineExchange(annotations: [item], evidence: []).merge(into: &reverse)
        }
        XCTAssertEqual(forward.annotations, reverse.annotations)
        XCTAssertEqual(forward.annotations.count, 2)
        XCTAssertEqual(forward.slices(in: DateInterval(start: start, end: date(1800))).first?.categories, [.walking, .prayer])
    }

    func testConflictingAnnotationIdentityRejectsEntireExchangeInsteadOfDependingOnImportOrder() throws {
        var ledger = TimelineLedger(startedAt: start)
        try ledger.annotate(start: start, end: date(60), categories: [.walking, .prayer], now: date(60))
        let original = ledger.annotations[0]
        let conflict = try ActivityAnnotation(id: original.id, deviceID: original.deviceID,
            start: original.start, end: original.end, categories: [.communication], recordedAt: original.recordedAt)
        let newRecord = ActivityAnnotation(id: UUID(), deviceID: UUID(), start: start, end: date(60), category: .reading, recordedAt: date(60))
        XCTAssertThrowsError(try TimelineExchange(annotations: [newRecord, conflict], evidence: []).merge(into: &ledger))
        XCTAssertEqual(ledger.annotations, [original])
    }

    func testReimportIntoOriginalFractionalDateRecordPreservesIdempotence() throws {
        // JSON uses Unix milliseconds, while Foundation Date stores reference-epoch seconds.
        // Their conversion can change sub-microsecond bits without changing the recorded activity.
        for fraction in [0.00000011920928955078125, 0.000001, 0.0001234, 0.1234567, 0.9999999] {
            let originalStart = Date(timeIntervalSinceReferenceDate: 815_000_000 + fraction)
            var original = TimelineLedger(startedAt: originalStart)
            try original.annotate(start: originalStart, end: originalStart.addingTimeInterval(60),
                categories: [.walking, .prayer], now: originalStart.addingTimeInterval(70))
            let before = original.annotations
            let exchange = try TimelineExchange.decode(TimelineExchange(annotations: before, evidence: []).encode())
            try exchange.merge(into: &original)
            try exchange.merge(into: &original)
            XCTAssertEqual(original.annotations, before)
        }
    }

    func testWirePrecisionStillRejectsChangedDeviceAndMillisecondTimestamps() throws {
        var ledger = TimelineLedger(startedAt: start)
        try ledger.annotate(start: start, end: date(60), category: .walking, now: date(70))
        let original = ledger.annotations[0]
        let conflicts = [
            ActivityAnnotation(id: original.id, deviceID: UUID(), start: start, end: date(60), category: .walking, recordedAt: date(70)),
            ActivityAnnotation(id: original.id, deviceID: original.deviceID, start: date(0.001), end: date(60), category: .walking, recordedAt: date(70)),
            ActivityAnnotation(id: original.id, deviceID: original.deviceID, start: start, end: date(60.001), category: .walking, recordedAt: date(70)),
            ActivityAnnotation(id: original.id, deviceID: original.deviceID, start: start, end: date(60), category: .walking, recordedAt: date(70.001))
        ]
        for conflict in conflicts {
            XCTAssertThrowsError(try TimelineExchange(annotations: [conflict], evidence: []).merge(into: &ledger))
            XCTAssertEqual(ledger.annotations, [original])
        }
    }
}
