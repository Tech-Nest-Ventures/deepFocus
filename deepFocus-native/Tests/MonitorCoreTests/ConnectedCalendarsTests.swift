import XCTest
@testable import MonitorCore

final class ConnectedCalendarsTests: XCTestCase {
    let device = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!
    let window = DateInterval(start: Date(timeIntervalSince1970: 1000), end: Date(timeIntervalSince1970: 9000))
    func event(_ id: String = "shared-event", calendar: String = "personal", start: Double = 2000,
               end: Double = 3000, title: String = "Reading", cancelled: Bool = false,
               updated: Double = 1000, occurrence: String = "single") -> CalendarAgendaEvent {
        CalendarAgendaEvent(id: id, calendarID: calendar, title: title,
            start: Date(timeIntervalSince1970: start), end: Date(timeIntervalSince1970: end),
            isCancelled: cancelled, updatedAt: Date(timeIntervalSince1970: updated), occurrenceID: occurrence)
    }

    func testMultipleCalendarsShowSeparateSameNamedIntentionsAndNoSelectionShowsNothing() {
        let events = [event(calendar: "work", start: 4000, end: 5000), event(), event(calendar: "hidden")]
        let agenda = ConnectedCalendarPolicy.agenda(events: events, selectedCalendarIDs: ["personal", "work"], in: window)
        XCTAssertEqual(agenda.map(\.calendarID), ["personal", "work"])
        XCTAssertEqual(agenda.map(\.title), ["Reading", "Reading"])
        XCTAssertTrue(ConnectedCalendarPolicy.agenda(events: events, selectedCalendarIDs: [], in: window).isEmpty)
    }
    func testAgendaDeduplicatesOccurrencesAndKeepsLatestCancellationOut() {
        let events = [event(updated: 1000), event(updated: 1000),
            event(title: "Moved", updated: 2000), event(calendar: "work"),
            event("cancel", updated: 1000), event("cancel", cancelled: true, updated: 2000),
            event(occurrence: "next"), event("actual", calendar: "actuals"),
            event("touch", start: 9000, end: 10000)]
        let agenda = ConnectedCalendarPolicy.agenda(events: events,
            selectedCalendarIDs: ["personal", "work", "actuals"], excludingCalendarIDs: ["actuals"], in: window)
        XCTAssertEqual(agenda.count, 3)
        XCTAssertEqual(agenda.filter { $0.calendarID == "personal" }.map(\.title).sorted(), ["Moved", "Reading"])
    }

    func testSnapshotRemovesDeletedAndDeselectedPlansWithoutTouchingOtherSourcesOrCreatingHours() throws {
        var ledger = TimelineLedger(startedAt: window.start)
        let otherDevice = UUID()
        try ConnectedCalendarPolicy.replaceSnapshot(events: [event()], selectedCalendarIDs: ["personal"],
            in: window, fetchedAt: Date(timeIntervalSince1970: 100), deviceID: otherDevice, into: &ledger)
        let manual = ContextEvidence(id: UUID(), deviceID: device, source: .calendar, start: window.start,
            end: window.end, recordedAt: window.start, label: "Manually imported plan",
            coarseLatitude: nil, coarseLongitude: nil, uncertaintyMeters: nil)
        try ledger.addEvidence(manual)
        try ConnectedCalendarPolicy.replaceSnapshot(events: [event(), event("work", calendar: "work"),
            event("removed", calendar: "work", start: 15000, end: 16000)], selectedCalendarIDs: ["personal", "work"],
            in: DateInterval(start: window.start, end: Date(timeIntervalSince1970: 20000)),
            fetchedAt: Date(timeIntervalSince1970: 200), deviceID: device, into: &ledger)
        XCTAssertEqual(ledger.evidence.count, 5)
        try ConnectedCalendarPolicy.replaceSnapshot(events: [event(title: "Updated reading", updated: 3000)],
            selectedCalendarIDs: ["personal"], in: window, fetchedAt: Date(timeIntervalSince1970: 300),
            deviceID: device, into: &ledger)
        XCTAssertEqual(ledger.evidence.count, 3)
        XCTAssertTrue(ledger.evidence.contains { $0.id == manual.id })
        XCTAssertTrue(ledger.evidence.contains { $0.deviceID == otherDevice })
        XCTAssertEqual(ledger.evidence.filter { $0.deviceID == device && $0.calendar != nil }.map(\.label), ["Updated reading"])
        XCTAssertTrue(ledger.intervals.isEmpty)
        XCTAssertTrue(ledger.annotations.isEmpty)
        ConnectedCalendarPolicy.clearSnapshot(deviceID: device, into: &ledger)
        XCTAssertEqual(ledger.evidence.count, 2)
    }

    func testActualsDraftIsOneElapsedIntervalWithMultipleActivitiesAndStableOwnership() throws {
        let draft = try XCTUnwrap(ConnectedCalendarPolicy.actualsDraft(start: window.start, end: window.end,
            categories: [.walking, .communication, .walking], deviceID: device))
        XCTAssertEqual(draft.title, "Communication + Walking")
        XCTAssertEqual(draft.end.timeIntervalSince(draft.start), 8000)
        XCTAssertTrue(ConnectedCalendarPolicy.isOwnedActualsMarker(draft.marker))
        let corrected = try XCTUnwrap(ConnectedCalendarPolicy.actualsDraft(start: window.start, end: window.end,
            categories: [.prayer], deviceID: device))
        XCTAssertEqual(draft.marker, corrected.marker)
        XCTAssertNil(ConnectedCalendarPolicy.actualsDraft(start: window.start, end: window.end,
            categories: [.unknown, .walking], deviceID: device))
        XCTAssertNil(ConnectedCalendarPolicy.actualsDraft(start: window.start, end: window.end,
            categories: [], deviceID: device))
        XCTAssertNil(ConnectedCalendarPolicy.actualsDraft(start: window.end, end: window.start,
            categories: [.walking], deviceID: device))
        XCTAssertFalse(ConnectedCalendarPolicy.isOwnedActualsMarker("Deep Focus — Actuals"))
        XCTAssertFalse(ConnectedCalendarPolicy.isOwnedActualsMarker("deepfocus-actuals:v1:garbage:garbage"))
        XCTAssertFalse(ConnectedCalendarPolicy.isOwnedActualsMarker(draft.marker + " extra notes"))
    }

    func testRepeatedRefreshIsIdempotentAndOlderVersionsCannotRestoreOldTitle() throws {
        var ledger = TimelineLedger(startedAt: window.start)
        let fetched = Date(timeIntervalSince1970: 5000)
        for _ in 0..<2 {
            try ConnectedCalendarPolicy.replaceSnapshot(events: [event(title: "New plan", updated: 3000)],
                selectedCalendarIDs: ["personal"], in: window, fetchedAt: fetched, deviceID: device, into: &ledger)
        }
        XCTAssertEqual(ledger.evidence.count, 1)
        XCTAssertFalse(try ConnectedCalendarPolicy.replaceSnapshot(events: [], selectedCalendarIDs: ["personal"],
            in: window, fetchedAt: Date(timeIntervalSince1970: 4000), deviceID: device,
            into: &ledger, lastAppliedAt: fetched))
        try ConnectedCalendarPolicy.replaceSnapshot(events: [event(title: "Old plan", updated: 1000)],
            selectedCalendarIDs: ["personal"], in: window, fetchedAt: Date(timeIntervalSince1970: 6000),
            deviceID: device, into: &ledger, lastAppliedAt: fetched)
        XCTAssertEqual(ledger.evidence.count, 1)
        XCTAssertEqual(ledger.evidence.first?.label, "New plan")
        XCTAssertThrowsError(try ConnectedCalendarPolicy.replaceSnapshot(events: [event(end: 100)],
            selectedCalendarIDs: ["personal"], in: window, fetchedAt: fetched, deviceID: device, into: &ledger))
        XCTAssertEqual(ledger.evidence.first?.label, "New plan")
    }

    func testConflictingSameVersionDoesNotChooseAnArbitraryIntention() {
        let first = event(title: "One plan")
        let second = event(title: "Different plan")
        for events in [[first, second], [second, first]] {
            XCTAssertTrue(ConnectedCalendarPolicy.agenda(events: events,
                selectedCalendarIDs: ["personal"], in: window).isEmpty)
        }
        let resolved = ConnectedCalendarPolicy.agenda(events: [first, second, event(title: "New plan", updated: 2000)],
            selectedCalendarIDs: ["personal"], in: window)
        XCTAssertEqual(resolved.map(\.title), ["New plan"])
    }

    func testOneConfirmationAcrossDesktopTransitionsPublishesOneStableInterval() throws {
        var ledger = TimelineLedger(startedAt: window.start)
        let editor = DesktopContext(bundleID: "test.editor", appName: "Editor", url: nil, hasRecentInput: true)
        let browser = DesktopContext(bundleID: "test.browser", appName: "Browser", url: nil, hasRecentInput: true)
        let middle = Date(timeIntervalSince1970: 5000)
        ledger.append(start: window.start, end: middle, context: editor)
        ledger.append(start: middle, end: window.end, context: browser)
        try ledger.annotate(start: window.start, end: window.end, categories: [.walking, .communication], now: window.end)
        let drafts = ConnectedCalendarPolicy.actualsDrafts(from: ledger.slices(in: window), deviceID: device)
        XCTAssertEqual(drafts.count, 1)
        XCTAssertEqual(drafts.first?.title, "Communication + Walking")
        XCTAssertEqual(drafts.first?.start, window.start)
        XCTAssertEqual(drafts.first?.end, window.end)
        let moreBoundaries = TimelineSlice(start: window.start, end: window.end, context: nil,
            categories: [.communication, .walking], basis: .confirmed)
        XCTAssertEqual(drafts, ConnectedCalendarPolicy.actualsDrafts(from: [moreBoundaries], deviceID: device))
    }

    func testUnknownObservedAndChangedActivitiesBreakPublishedRuns() {
        let slices = [
            TimelineSlice(start: Date(timeIntervalSince1970: 1000), end: Date(timeIntervalSince1970: 2000),
                context: nil, categories: [.walking], basis: .confirmed),
            TimelineSlice(start: Date(timeIntervalSince1970: 2000), end: Date(timeIntervalSince1970: 3000),
                context: nil, categories: [.walking], basis: .observed),
            TimelineSlice(start: Date(timeIntervalSince1970: 3000), end: Date(timeIntervalSince1970: 4000),
                context: nil, categories: [.walking], basis: .confirmed),
            TimelineSlice(start: Date(timeIntervalSince1970: 4000), end: Date(timeIntervalSince1970: 5000),
                context: nil, categories: [.unknown], basis: .leftUnknown),
            TimelineSlice(start: Date(timeIntervalSince1970: 5000), end: Date(timeIntervalSince1970: 6000),
                context: nil, categories: [.walking], basis: .confirmed),
            TimelineSlice(start: Date(timeIntervalSince1970: 6000), end: Date(timeIntervalSince1970: 7000),
                context: nil, categories: [.prayer, .walking], basis: .confirmed)
        ]
        let drafts = ConnectedCalendarPolicy.actualsDrafts(from: slices, deviceID: device)
        XCTAssertEqual(drafts.map { $0.start.timeIntervalSince1970 }, [1000, 3000, 5000, 6000])
        XCTAssertEqual(drafts.map { $0.end.timeIntervalSince1970 }, [2000, 4000, 6000, 7000])
        XCTAssertEqual(drafts.map(\.title), ["Walking", "Walking", "Walking", "Walking + Prayer"])
        XCTAssertEqual(drafts.reduce(0) { $0 + $1.end.timeIntervalSince($1.start) }, 4000)
    }

    func testPublishingNormalizesFractionalTimesWithoutChangingTimelineAndKeepsRoundtripMarker() throws {
        let start = Date(timeIntervalSince1970: 2000.1234567)
        let end = Date(timeIntervalSince1970: 3000.8765432)
        let original = try XCTUnwrap(ConnectedCalendarPolicy.actualsDraft(start: start, end: end,
            categories: [.walking], deviceID: device))
        XCTAssertEqual(original.start.timeIntervalSince1970, 2000)
        XCTAssertEqual(original.end.timeIntervalSince1970, 3001)
        let reimported = try XCTUnwrap(ConnectedCalendarPolicy.actualsDraft(
            start: Date(timeIntervalSince1970: 2000.1234568), end: Date(timeIntervalSince1970: 3000.8765431),
            categories: [.walking], deviceID: device))
        XCTAssertEqual(original, reimported)
        XCTAssertEqual(start.timeIntervalSince1970, 2000.1234567, accuracy: 0.000001)
        XCTAssertEqual(end.timeIntervalSince1970, 3000.8765432, accuracy: 0.000001)
        XCTAssertNil(ConnectedCalendarPolicy.actualsDraft(start: Date(timeIntervalSince1970: 2000.1),
            end: Date(timeIntervalSince1970: 2000.4), categories: [.walking], deviceID: device))
    }

    func testPublicationCoalescesBeforeRoundingSubsecondObservationBoundaries() throws {
        let start = Date(timeIntervalSince1970: 2000.1)
        let firstBoundary = Date(timeIntervalSince1970: 2000.3)
        let secondBoundary = Date(timeIntervalSince1970: 2000.7)
        let end = Date(timeIntervalSince1970: 3000.9)
        let slices = [
            TimelineSlice(start: start, end: firstBoundary, context: nil, categories: [.walking], basis: .confirmed),
            TimelineSlice(start: firstBoundary, end: secondBoundary, context: nil, categories: [.walking], basis: .confirmed),
            TimelineSlice(start: secondBoundary, end: end, context: nil, categories: [.walking], basis: .confirmed)
        ]
        let whole = try XCTUnwrap(ConnectedCalendarPolicy.actualsDraft(start: start, end: end,
            categories: [.walking], deviceID: device))
        XCTAssertEqual(ConnectedCalendarPolicy.actualsDrafts(from: slices, deviceID: device), [whole])
    }

}
