import Foundation
import Combine
import EventKit

/// The boundary is injectable so permission and selection behavior can be checked without
/// requesting Calendar access or touching a person's real events.
@MainActor
protocol ConnectedCalendarBackend: AnyObject {
    var authorization: EKAuthorizationStatus { get }
    func requestFullAccess() async throws -> Bool
    func calendars() -> [ConnectedCalendar]
    func events(in range: DateInterval, calendarIDs: Set<String>) -> [CalendarAgendaEvent]
    func publish(_ drafts: [CalendarActualsDraft], to calendarID: String) throws -> Int
}

enum ConnectedCalendarError: LocalizedError {
    case unavailable, invalidDraft, collision
    var errorDescription: String? {
        switch self {
        case .unavailable: return "Connect Calendars and choose a writable Deep Focus — Actuals calendar."
        case .invalidDraft: return "Review the confirmed activities again before publishing."
        case .collision: return "A previously published entry was changed, removed, or overlaps this selection. No events were changed."
        }
    }
}

@MainActor
final class ConnectedCalendarStore: ObservableObject {
    @Published private(set) var calendars: [ConnectedCalendar] = []
    @Published private(set) var agenda: [CalendarAgendaEvent] = []
    @Published private(set) var selectedCalendarIDs: Set<String>
    @Published private(set) var accountAliases: [String: String]
    @Published private(set) var isConnected = false
    @Published private(set) var status = "Connect calendars to see your plans from multiple accounts."
    var onSnapshot: (([CalendarAgendaEvent], DateInterval, Date, Set<String>, Set<String>) -> Void)?
    var onClear: (() -> Void)?

    private let backend: ConnectedCalendarBackend
    private let defaults: UserDefaults
    private var enabled: Bool
    private var generation = 0
    private var observer: NSObjectProtocol?
    private var range: DateInterval

    init(backend: ConnectedCalendarBackend? = nil, defaults: UserDefaults = .standard) {
        self.backend = backend ?? EventKitCalendarBackend(defaults: defaults)
        self.defaults = defaults
        enabled = defaults.bool(forKey: "calendarIntegrationEnabled")
        selectedCalendarIDs = Set(defaults.stringArray(forKey: "selectedCalendarIDs") ?? [])
        accountAliases = defaults.dictionary(forKey: "calendarAccountAliases") as? [String: String] ?? [:]
        range = Calendar.current.dateInterval(of: .day, for: Date())!
        observer = NotificationCenter.default.addObserver(forName: .EKEventStoreChanged, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor [weak self] in self?.refresh() }
        }
        // The owner installs its snapshot callbacks before its first explicit refresh.
    }

    deinit { if let observer { NotificationCenter.default.removeObserver(observer) } }

    var writableActualsCalendars: [ConnectedCalendar] {
        calendars.filter { $0.isWritable && $0.title == ConnectedCalendarPolicy.actualsCalendarTitle }
    }

    func accountName(for calendar: ConnectedCalendar) -> String {
        accountAliases[calendar.accountID] ?? calendar.accountName
    }

    func setAccountAlias(_ alias: String, for accountID: String) {
        let value = String(alias.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
        accountAliases[accountID] = value.isEmpty ? nil : value
        defaults.set(accountAliases, forKey: "calendarAccountAliases")
    }

    /// The only path that can trigger the OS authorization sheet. Call from Connect.
    func connect() async {
        generation += 1
        let request = generation
        status = "Connecting calendars…"
        do {
            let granted = backend.authorization == .fullAccess ? true : try await backend.requestFullAccess()
            guard request == generation else { return }
            guard granted, backend.authorization == .fullAccess else {
                invalidate("Calendar access is unavailable. Allow full access in System Settings or Settings to connect.")
                return
            }
            enabled = true
            defaults.set(true, forKey: "calendarIntegrationEnabled")
            refresh()
        } catch {
            guard request == generation else { return }
            invalidate("Calendar access could not be enabled. Try Connect again.")
        }
    }

    func disconnect() {
        invalidate("Calendars disconnected. Local connected calendar intentions were removed.")
    }

    func setSelectedCalendarIDs(_ ids: Set<String>) {
        generation += 1
        let allowed = Set(calendars.filter { $0.title != ConnectedCalendarPolicy.actualsCalendarTitle }.map(\.id))
        selectedCalendarIDs = ids.intersection(allowed)
        defaults.set(selectedCalendarIDs.sorted(), forKey: "selectedCalendarIDs")
        agenda = []
        onClear?()
        refresh()
    }

    /// Reads the account list and only the explicitly selected event calendars.
    /// Foreground activation, date changes and the Refresh button use this path.
    func refresh(in requestedRange: DateInterval? = nil) {
        if let requestedRange {
            guard requestedRange.duration > 0, requestedRange.duration <= 32 * 86_400,
                  requestedRange.start.timeIntervalSince1970.isFinite,
                  requestedRange.end.timeIntervalSince1970.isFinite else { return }
            range = requestedRange
        }
        guard enabled else { agenda = []; calendars = []; isConnected = false; return }
        generation += 1
        let request = generation
        guard backend.authorization == .fullAccess else {
            invalidate("Calendar access was removed. Connect again after allowing full access.")
            return
        }
        let fetchedCalendars = backend.calendars()
        let excluded = Set(fetchedCalendars.filter { $0.title == ConnectedCalendarPolicy.actualsCalendarTitle }.map(\.id))
        let available = Set(fetchedCalendars.map(\.id)).subtracting(excluded)
        let selection = selectedCalendarIDs.intersection(available)
        if selection != selectedCalendarIDs {
            selectedCalendarIDs = selection
            defaults.set(selection.sorted(), forKey: "selectedCalendarIDs")
            onClear?()
        }
        // Never pass an empty/nil calendar selection to EventKit: nil means ALL calendars.
        let events = selection.isEmpty ? [] : backend.events(in: range, calendarIDs: selection)
        guard request == generation, enabled, backend.authorization == .fullAccess else {
            invalidate("Calendar access changed. Connect again to refresh your plans.")
            return
        }
        calendars = fetchedCalendars
        agenda = ConnectedCalendarPolicy.agenda(events: events, selectedCalendarIDs: selection,
                                                 excludingCalendarIDs: excluded, in: range)
        isConnected = true
        status = selection.isEmpty ? "Choose the calendars to include. Nothing is selected by default."
            : "Updated from calendars configured on this device. Calendar entries are intentions."
        onSnapshot?(agenda, range, Date(), selection, excluded)
    }

    /// An explicit publication action after the UI has shown its preview. It never runs
    /// during refresh, import, background activation, or selection changes.
    @discardableResult
    func publish(_ drafts: [CalendarActualsDraft], to calendarID: String) throws -> Int {
        guard enabled, backend.authorization == .fullAccess else {
            invalidate("Calendar access is unavailable. Reconnect before publishing.")
            throw ConnectedCalendarError.unavailable
        }
        guard backend.calendars().contains(where: {
            $0.id == calendarID && $0.isWritable && $0.title == ConnectedCalendarPolicy.actualsCalendarTitle
        }) else { throw ConnectedCalendarError.unavailable }
        guard !drafts.isEmpty, drafts.allSatisfy({
            $0.start < $0.end && $0.start.timeIntervalSince1970.isFinite && $0.end.timeIntervalSince1970.isFinite
                && !$0.title.isEmpty && ConnectedCalendarPolicy.isOwnedActualsMarker($0.marker)
        }), Set(drafts.map(\.marker)).count == drafts.count else { throw ConnectedCalendarError.invalidDraft }
        let ordered = drafts.sorted { $0.start < $1.start }
        guard zip(ordered, ordered.dropFirst()).allSatisfy({ $0.end <= $1.start }) else {
            throw ConnectedCalendarError.collision
        }
        let count = try backend.publish(drafts, to: calendarID)
        status = count == 0 ? "These confirmed activities are already published." : "Published \(count) confirmed activities to Deep Focus — Actuals."
        return count
    }

    private func invalidate(_ message: String) {
        generation += 1
        enabled = false
        defaults.set(false, forKey: "calendarIntegrationEnabled")
        isConnected = false
        agenda = []
        calendars = []
        status = message
        onClear?()
    }
}

/// Immutable published entries protect edits made later in Notion or another calendar client.
/// The adapter resolves its identifier receipt first, including events moved outside the query day.
struct ActualsPublicationRecord {
    let calendarID: String
    var title: String
    var start: Date
    var end: Date
    let marker: String?
    let url: URL?
    let isAllDay: Bool
    let hasRecurrence: Bool
    let hasParticipants: Bool

    /// Correcting or splitting an already published interval must not leave both
    /// the old whole interval and new fragments in the destination calendar.
    func verifyNoConflictingOverlap(draft: CalendarActualsDraft, calendarID: String) throws {
        guard self.calendarID == calendarID, start < draft.end, end > draft.start else { return }
        let owned = marker.map(ConnectedCalendarPolicy.isOwnedActualsMarker) ?? false
        guard owned || url?.scheme == "deepfocus-actuals" else { return }
        try verifyUnchanged(draft: draft, calendarID: calendarID)
    }

    func verifyUnchanged(draft: CalendarActualsDraft, calendarID: String) throws {
        guard self.calendarID == calendarID, marker == draft.marker,
              url == actualsMarkerURL(draft.marker), title == draft.title,
              start == draft.start, end == draft.end, !isAllDay,
              !hasRecurrence, !hasParticipants else { throw ConnectedCalendarError.collision }
    }
}

func actualsMarkerURL(_ marker: String) -> URL? { URL(string: "deepfocus-actuals://entry/" + marker) }

@MainActor
private final class EventKitCalendarBackend: ConnectedCalendarBackend {
    private let store = EKEventStore()
    private let defaults: UserDefaults
    private var publicationReceipts: [String: String]
    init(defaults: UserDefaults) {
        self.defaults = defaults
        publicationReceipts = defaults.dictionary(forKey: "calendarActualsPublicationReceipts") as? [String: String] ?? [:]
    }
    var authorization: EKAuthorizationStatus { EKEventStore.authorizationStatus(for: .event) }

    func requestFullAccess() async throws -> Bool { try await store.requestFullAccessToEvents() }

    func calendars() -> [ConnectedCalendar] {
        guard authorization == .fullAccess else { return [] }
        return store.calendars(for: .event).map { calendar in
            ConnectedCalendar(id: calendar.calendarIdentifier, accountID: calendar.source.sourceIdentifier,
                accountName: calendar.source.title, title: calendar.title,
                colorHex: Self.hex(calendar.cgColor), isWritable: calendar.allowsContentModifications)
        }.sorted { ($0.accountName, $0.title, $0.id) < ($1.accountName, $1.title, $1.id) }
    }

    func events(in range: DateInterval, calendarIDs: Set<String>) -> [CalendarAgendaEvent] {
        guard authorization == .fullAccess, !calendarIDs.isEmpty else { return [] }
        let selected = store.calendars(for: .event).filter {
            calendarIDs.contains($0.calendarIdentifier) && $0.title != ConnectedCalendarPolicy.actualsCalendarTitle
        }
        guard !selected.isEmpty else { return [] }
        let predicate = store.predicateForEvents(withStart: range.start, end: range.end, calendars: selected)
        return store.events(matching: predicate).compactMap { event in
            guard let start = event.startDate, let end = event.endDate, start < end,
                  let id = event.eventIdentifier, !id.isEmpty,
                  !Self.isOwnedEvent(event) else { return nil }
            return CalendarAgendaEvent(id: id, calendarID: event.calendar.calendarIdentifier,
                externalID: event.calendarItemExternalIdentifier, title: String((event.title ?? "Calendar intention").prefix(120)),
                start: start, end: end, isAllDay: event.isAllDay, isCancelled: event.status == .canceled,
                updatedAt: event.lastModifiedDate ?? Date(),
                occurrenceID: event.occurrenceDate.map { String($0.timeIntervalSince1970) } ?? "single",
                timeZoneID: event.timeZone?.identifier ?? TimeZone.current.identifier)
        }
    }

    func publish(_ drafts: [CalendarActualsDraft], to calendarID: String) throws -> Int {
        guard authorization == .fullAccess, let calendar = store.calendar(withIdentifier: calendarID),
              calendar.allowsContentModifications, calendar.title == ConnectedCalendarPolicy.actualsCalendarTitle else {
            throw ConnectedCalendarError.unavailable
        }
        // Receipts contain identifiers only, never event contents. A moved, deleted or
        // edited previously published event fails closed instead of being duplicated/replaced.
        var newDrafts: [CalendarActualsDraft] = []
        var receipts = publicationReceipts
        for draft in drafts {
            let key = calendarID + "\n" + draft.marker
            // Check all owned overlaps even when an identifier receipt exists. A
            // different marker can represent an older unsplit or corrected interval.
            let predicate = store.predicateForEvents(withStart: draft.start, end: draft.end, calendars: [calendar])
            let overlapping = store.events(matching: predicate).filter {
                $0.startDate < draft.end && $0.endDate > draft.start
            }
            guard overlapping.filter(Self.isOwnedEvent).count <= 1 else { throw ConnectedCalendarError.collision }
            for event in overlapping {
                try Self.publicationRecord(event).verifyNoConflictingOverlap(draft: draft, calendarID: calendarID)
            }
            let existing: EKEvent?
            if let identifier = publicationReceipts[key] {
                guard let event = store.event(withIdentifier: identifier) else { throw ConnectedCalendarError.collision }
                existing = event
            } else {
                let candidates = overlapping.filter {
                    $0.notes == draft.marker || $0.url == actualsMarkerURL(draft.marker)
                }
                guard candidates.count <= 1 else { throw ConnectedCalendarError.collision }
                existing = candidates.first
            }
            if let event = existing {
                try Self.publicationRecord(event).verifyUnchanged(draft: draft, calendarID: calendarID)
                receipts[key] = event.eventIdentifier ?? "unresolved"
            } else { newDrafts.append(draft) }
        }
        guard authorization == .fullAccess,
              store.calendar(withIdentifier: calendarID)?.allowsContentModifications == true,
              store.calendar(withIdentifier: calendarID)?.title == ConnectedCalendarPolicy.actualsCalendarTitle else {
            throw ConnectedCalendarError.unavailable
        }
        do {
            var created: [(String, EKEvent)] = []
            for draft in newDrafts {
                let event = EKEvent(eventStore: store)
                event.calendar = calendar
                event.title = draft.title
                event.startDate = draft.start
                event.endDate = draft.end
                event.isAllDay = false
                event.notes = draft.marker
                event.url = actualsMarkerURL(draft.marker)
                try store.save(event, span: .thisEvent, commit: false)
                created.append((calendarID + "\n" + draft.marker, event))
            }
            if !created.isEmpty { try store.commit() }
            for (key, event) in created { receipts[key] = event.eventIdentifier ?? "unresolved" }
            publicationReceipts = receipts
            defaults.set(receipts, forKey: "calendarActualsPublicationReceipts")
        } catch {
            store.reset()
            throw error
        }
        return newDrafts.count
    }

    private static func publicationRecord(_ event: EKEvent) -> ActualsPublicationRecord {
        ActualsPublicationRecord(calendarID: event.calendar.calendarIdentifier,
            title: event.title ?? "", start: event.startDate, end: event.endDate,
            marker: event.notes, url: event.url, isAllDay: event.isAllDay,
            hasRecurrence: event.hasRecurrenceRules, hasParticipants: !(event.attendees?.isEmpty ?? true))
    }

    private static func isOwnedEvent(_ event: EKEvent) -> Bool {
        if let notes = event.notes, ConnectedCalendarPolicy.isOwnedActualsMarker(notes) { return true }
        return event.url?.scheme == "deepfocus-actuals"
    }

    private static func hex(_ color: CGColor?) -> String {
        guard let color, let rgb = color.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil),
              let values = rgb.components, values.count >= 3 else { return "#777777" }
        return String(format: "#%02X%02X%02X", Int(values[0] * 255), Int(values[1] * 255), Int(values[2] * 255))
    }
}
