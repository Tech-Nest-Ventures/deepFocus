import XCTest
import CryptoKit
@testable import MonitorCore

final class TimelineTests: XCTestCase {
    let base = Date(timeIntervalSince1970: 1_800_000_000)
    var editor: DesktopContext { DesktopContext(bundleID: "com.editor", appName: "Editor", url: nil, hasRecentInput: true) }
    func date(_ seconds: Double) -> Date { base.addingTimeInterval(seconds) }
    func range(_ seconds: Double) -> DateInterval { DateInterval(start: base, end: date(seconds)) }

    func testDurationsUsePreviousObservationAndMergeContinuousIntervals() {
        var recorder = DurationRecorder()
        var ledger = TimelineLedger(startedAt: base)
        let browser = DesktopContext(bundleID: "com.google.Chrome", appName: "Chrome", url: "https://example.com/private?token=secret", hasRecentInput: true)
        recorder.sample(editor, wall: base, uptime: 100, into: &ledger)
        recorder.sample(editor, wall: date(1), uptime: 101, into: &ledger)
        recorder.sample(browser, wall: date(2), uptime: 102, into: &ledger)
        recorder.sample(browser, wall: date(3), uptime: 103, into: &ledger)
        XCTAssertEqual(ledger.intervals.count, 2)
        XCTAssertEqual(ledger.intervals[0].end.timeIntervalSince(base), 2)
        XCTAssertEqual(ledger.intervals[1].context.websiteHost, "example.com")
        XCTAssertEqual(ledger.slices(in: range(3)).reduce(0) { $0 + $1.duration }, 3)
    }

    func testPauseAndSleepDoNotCreatePhantomWork() {
        var recorder = DurationRecorder()
        var ledger = TimelineLedger(startedAt: base)
        recorder.sample(editor, wall: base, uptime: 100, into: &ledger)
        recorder.sample(nil, wall: date(1), uptime: 101, into: &ledger)
        recorder.sample(nil, wall: date(100), uptime: 200, into: &ledger)
        recorder.sample(editor, wall: date(1000), uptime: 1100, into: &ledger)
        recorder.sample(editor, wall: date(1001), uptime: 1101, into: &ledger)
        recorder.sample(editor, wall: date(5000), uptime: 5100, into: &ledger)
        XCTAssertEqual(ledger.intervals.reduce(0) { $0 + $1.end.timeIntervalSince($1.start) }, 2)
    }

    func testClockJumpDiscardsUncoveredTime() {
        for jump in [-100.0, 100.0] {
            var recorder = DurationRecorder()
            var ledger = TimelineLedger(startedAt: base)
            recorder.sample(editor, wall: base, uptime: 100, into: &ledger)
            recorder.sample(editor, wall: date(jump), uptime: 101, into: &ledger)
            XCTAssertTrue(ledger.intervals.isEmpty)
        }
    }

    func testCorrectionsPartitionWithoutOverwritingObservationsOrDoubleCounting() throws {
        var ledger = TimelineLedger(startedAt: base)
        ledger.append(start: base, end: date(60), context: editor)
        try ledger.annotate(start: date(10), end: date(40), category: .planning, now: date(70))
        try ledger.annotate(start: date(20), end: date(30), category: .family, now: date(80))
        let slices = ledger.slices(in: range(60))
        XCTAssertEqual(slices.reduce(0) { $0 + $1.duration }, 60)
        XCTAssertEqual(slices.filter { $0.category == .family }.reduce(0) { $0 + $1.duration }, 10)
        XCTAssertEqual(ledger.intervals.count, 1)
        XCTAssertEqual(ledger.annotations.count, 2)
        XCTAssertEqual(slices.filter { $0.category == .planning }.reduce(0) { $0 + $1.duration }, 20)
    }

    func testGapReviewRequiresReturnAndRespectsQuietAndLeaveUnknown() throws {
        var ledger = TimelineLedger(startedAt: base)
        ledger.append(start: base, end: date(60), context: editor)
        XCTAssertTrue(ledger.reviewCandidates(in: range(2000), now: date(2000)).isEmpty)
        ledger.append(start: date(1900), end: date(2000), context: editor)
        XCTAssertEqual(ledger.reviewCandidates(in: range(2000), now: date(2000)).count, 1)
        ledger.quietUntil = date(3000)
        XCTAssertTrue(ledger.reviewCandidates(in: range(2000), now: date(2000)).isEmpty)
        ledger.quietUntil = nil
        try ledger.annotate(start: date(60), end: date(1900), category: .unknown, now: date(2000))
        XCTAssertTrue(ledger.reviewCandidates(in: range(2000), now: date(2000)).isEmpty)
        XCTAssertEqual(ledger.slices(in: range(2000)).filter { $0.basis == .leftUnknown }.count, 1)
    }

    func testLowInputCanBeConfirmedAsReading() throws {
        var ledger = TimelineLedger(startedAt: base)
        let reading = DesktopContext(bundleID: "com.reader", appName: "Reader", url: nil, hasRecentInput: false)
        ledger.append(start: base, end: date(1800), context: reading)
        ledger.append(start: date(1800), end: date(1810), context: editor)
        XCTAssertEqual(ledger.reviewCandidates(in: range(1810), now: date(1810)).count, 1)
        try ledger.annotate(start: base, end: date(1800), category: .reading, now: date(1810))
        XCTAssertTrue(ledger.reviewCandidates(in: range(1810), now: date(1810)).isEmpty)
        XCTAssertEqual(ledger.slices(in: range(1810))[0].category, .reading)
    }

    func testCalendarPlaceAndParallelAgentsDoNotBecomeHumanTime() throws {
        var ledger = TimelineLedger(startedAt: base)
        for source in [ContextEvidence.Source.calendar, .phoneVisit, .agentTask, .agentTask, .camera, .eeg] {
            try ledger.addEvidence(ContextEvidence(id: UUID(), deviceID: UUID(), source: source,
                start: base, end: date(1800), recordedAt: date(1800), label: "Synthetic context",
                coarseLatitude: nil, coarseLongitude: nil, uncertaintyMeters: nil))
        }
        XCTAssertEqual(ledger.slices(in: range(1800))[0].basis, .unknown)
        XCTAssertEqual(ledger.slices(in: range(1800)).filter { $0.context != nil }.count, 0)
        ledger.append(start: base, end: date(60), context: editor)
        XCTAssertEqual(ledger.slices(in: range(1800)).filter { $0.context != nil }.reduce(0) { $0 + $1.duration }, 60)
    }

    func testLocalArchiveNeverContainsURLPathsQueriesOrCredentials() throws {
        var ledger = TimelineLedger(startedAt: base)
        ledger.append(start: base, end: date(60), context: DesktopContext(bundleID: "com.browser", appName: "Browser",
            url: "https://username:password@example.com/sensitive-path?token=secret#fragment", hasRecentInput: true))
        let data = try TimelineArchive.encode(ledger)
        let text = String(decoding: data, as: UTF8.self)
        for value in ["sensitive-path", "username", "password", "token=secret", "fragment"] { XCTAssertFalse(text.contains(value)) }
        let restored = try TimelineArchive.decode(data)
        XCTAssertEqual(restored.intervals[0].context.websiteHost, "example.com")
    }

    func testExchangeIsIdempotentAndPreservesProvenanceAndQuietPeriod() throws {
        var phone = TimelineLedger(startedAt: base)
        try phone.annotate(start: base, end: date(60), category: .prayer, now: date(70))
        let exchange = TimelineExchange(annotations: phone.annotations, evidence: [], quietUntil: date(5000))
        var desktop = TimelineLedger(startedAt: date(100))
        let decoded = try TimelineExchange.decode(exchange.encode())
        try decoded.merge(into: &desktop)
        try decoded.merge(into: &desktop)
        XCTAssertEqual(desktop.annotations.count, 1)
        XCTAssertEqual(desktop.annotations[0].deviceID, phone.deviceID)
        XCTAssertEqual(desktop.quietUntil, date(5000))
        XCTAssertEqual(desktop.startedAt, base)
    }

    func testInvalidIntervalsAndIncompatibleArchivesAreRejected() throws {
        var ledger = TimelineLedger(startedAt: base)
        XCTAssertThrowsError(try ledger.annotate(start: date(60), end: base, category: .reading, now: date(100)))
        XCTAssertThrowsError(try ledger.annotate(start: base, end: date(200), category: .reading, now: date(100)))
        ledger.schemaVersion = 99
        XCTAssertThrowsError(try TimelineArchive.encode(ledger))
        XCTAssertThrowsError(try TimelineExchange.decode(Data("{}".utf8)))
        XCTAssertThrowsError(try TimelineArchive.decode(Data("broken".utf8)))
    }

    func testDSTDayUsesCalendarBoundariesAndClipsDurations() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let date = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 11, day: 1, hour: 12)))
        let day = try XCTUnwrap(calendar.dateInterval(of: .day, for: date))
        XCTAssertEqual(day.duration, 25 * 3600)
        var ledger = TimelineLedger(startedAt: day.start)
        ledger.append(start: day.start.addingTimeInterval(-60), end: day.end.addingTimeInterval(60), context: editor)
        XCTAssertEqual(ledger.slices(in: day).reduce(0) { $0 + $1.duration }, 25 * 3600)
    }

    func testFrozenCharterChecksum() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let directory = root.appendingPathComponent("docs/product-direction")
        let data = try Data(contentsOf: directory.appendingPathComponent("2026-11-06-v1.md"))
        let expected = try String(contentsOf: directory.appendingPathComponent("2026-11-06-v1.sha256")).split(separator: " ").first
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        XCTAssertEqual(digest, expected.map(String.init))
    }
}
