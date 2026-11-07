import Foundation
import EventKit

@MainActor
final class CalendarBoundaryStub: ConnectedCalendarBackend {
    var authorization: EKAuthorizationStatus = .fullAccess
    var catalog = [ConnectedCalendar(id: "work", accountID: "one", accountName: "Work", title: "Calendar", colorHex: "#123456", isWritable: true)]
    var queries: [Set<String>] = []
    var records: [CalendarAgendaEvent] = []
    var requestContinuation: CheckedContinuation<Bool, Error>?
    var waitForPermission = false
    var publishedCount = 0
    func requestFullAccess() async throws -> Bool {
        if waitForPermission { return try await withCheckedThrowingContinuation { requestContinuation = $0 } }
        return authorization == .fullAccess
    }
    func calendars() -> [ConnectedCalendar] { catalog }
    func events(in range: DateInterval, calendarIDs: Set<String>) -> [CalendarAgendaEvent] {
        queries.append(calendarIDs)
        return records
    }
    func publish(_ drafts: [CalendarActualsDraft], to calendarID: String) throws -> Int { publishedCount += drafts.count; return drafts.count }
}

@main
struct ConnectedCalendarStoreProbe {
    @MainActor static func main() async throws {
        let suite = "DeepFocusCalendarProbe-\(UUID())"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let boundary = CalendarBoundaryStub()
        let store = ConnectedCalendarStore(backend: boundary, defaults: defaults)
        var clearCount = 0
        store.onClear = { clearCount += 1 }
        await store.connect()
        precondition(store.isConnected)
        precondition(boundary.queries.isEmpty, "No calendars selected must never read every calendar")
        store.setSelectedCalendarIDs(["work"])
        precondition(boundary.queries == [["work"]])
        boundary.authorization = .denied
        store.refresh()
        precondition(store.agenda.isEmpty && store.calendars.isEmpty && !store.isConnected)
        precondition(clearCount > 0, "Revocation must clear persisted connected intentions through the callback")
        boundary.authorization = .notDetermined
        boundary.waitForPermission = true
        let pending = Task { await store.connect() }
        while boundary.requestContinuation == nil { await Task.yield() }
        store.refresh() // An EventKit notification during the permission sheet must not cancel Connect.
        boundary.authorization = .fullAccess
        boundary.requestContinuation!.resume(returning: true)
        await pending.value
        precondition(store.isConnected, "A harmless refresh while disconnected must not cancel an explicit pending Connect")
        boundary.authorization = .notDetermined
        let pendingThenStopped = Task { await store.connect() }
        boundary.requestContinuation = nil
        while boundary.requestContinuation == nil { await Task.yield() }
        store.disconnect()
        boundary.authorization = .fullAccess
        boundary.requestContinuation!.resume(returning: true)
        await pendingThenStopped.value
        precondition(!store.isConnected && store.agenda.isEmpty, "Disconnect must win over delayed authorization")
        boundary.waitForPermission = false
        await store.connect()
        let draft = ConnectedCalendarPolicy.actualsDraft(start: Date(timeIntervalSince1970: 100),
            end: Date(timeIntervalSince1970: 200), categories: [.walking, .prayer], deviceID: UUID())!
        do { _ = try store.publish([draft], to: "work"); preconditionFailure("Must not publish to a planned calendar") }
        catch ConnectedCalendarError.unavailable {}
        precondition(boundary.publishedCount == 0)
        boundary.catalog.append(ConnectedCalendar(id: "actuals", accountID: "one", accountName: "Work",
            title: ConnectedCalendarPolicy.actualsCalendarTitle, colorHex: "#123456", isWritable: true))
        store.refresh()
        store.setSelectedCalendarIDs(["work", "actuals"])
        precondition(store.selectedCalendarIDs == ["work"], "Actuals cannot feed back into intentions")
        precondition(boundary.publishedCount == 0, "Connect, refresh and selection never publish")
        try store.publish([draft], to: "actuals")
        precondition(boundary.publishedCount == 1)
        let unchanged = ActualsPublicationRecord(calendarID: "actuals", title: draft.title,
            start: draft.start, end: draft.end, marker: draft.marker,
            url: actualsMarkerURL(draft.marker), isAllDay: false, hasRecurrence: false, hasParticipants: false)
        try unchanged.verifyUnchanged(draft: draft, calendarID: "actuals")
        var moved = unchanged
        moved.start = moved.start.addingTimeInterval(86_400)
        do { try moved.verifyUnchanged(draft: draft, calendarID: "actuals"); preconditionFailure("Moved actuals must not be overwritten") }
        catch ConnectedCalendarError.collision {}
        var edited = unchanged
        edited.title = "My correction in Notion"
        do { try edited.verifyUnchanged(draft: draft, calendarID: "actuals"); preconditionFailure("User-edited actuals must not be overwritten") }
        catch ConnectedCalendarError.collision {}
        let correctedHalf = ConnectedCalendarPolicy.actualsDraft(start: Date(timeIntervalSince1970: 150),
            end: Date(timeIntervalSince1970: 200), categories: [.reading], deviceID: UUID())!
        do {
            try unchanged.verifyNoConflictingOverlap(draft: correctedHalf, calendarID: "actuals")
            preconditionFailure("A new split interval must not overlap an already published owned interval")
        } catch ConnectedCalendarError.collision {}
        do {
            try store.publish([draft, correctedHalf], to: "actuals")
            preconditionFailure("A single publication batch must not contain overlapping intervals")
        } catch ConnectedCalendarError.collision {}
        precondition(boundary.publishedCount == 1)
        try unchanged.verifyNoConflictingOverlap(draft: draft, calendarID: "actuals")
        let following = ConnectedCalendarPolicy.actualsDraft(start: Date(timeIntervalSince1970: 200),
            end: Date(timeIntervalSince1970: 300), categories: [.walking], deviceID: UUID())!
        try unchanged.verifyNoConflictingOverlap(draft: following, calendarID: "actuals")
        let ordinary = ActualsPublicationRecord(calendarID: "actuals", title: "My plan",
            start: draft.start, end: draft.end, marker: nil, url: nil,
            isAllDay: false, hasRecurrence: false, hasParticipants: false)
        try ordinary.verifyNoConflictingOverlap(draft: correctedHalf, calendarID: "actuals")
        print("Connected calendar permission, scope and publication probes passed")
    }
}
