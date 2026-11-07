import Foundation

/// Identifiers belong to the local EventKit store; display names are never identity keys.
struct ConnectedCalendar: Identifiable, Equatable {
    let id: String
    let accountID: String
    let accountName: String
    let title: String
    let colorHex: String
    let isWritable: Bool
}

struct CalendarAgendaEvent: Identifiable, Equatable {
    let id: String
    let calendarID: String
    var externalID: String? = nil
    let title: String
    let start: Date
    let end: Date
    var isAllDay = false
    var isCancelled = false
    let updatedAt: Date
    var occurrenceID = "single"
    var timeZoneID = TimeZone.current.identifier

    var identity: [String] { [calendarID, id, occurrenceID] }
    var isValid: Bool {
        identity.allSatisfy { !$0.isEmpty && $0.count <= 512 }
            && start.timeIntervalSince1970.isFinite && end.timeIntervalSince1970.isFinite
            && end > start && updatedAt.timeIntervalSince1970.isFinite
            && TimeZone(identifier: timeZoneID) != nil
    }
}

enum ConnectedCalendarPolicy {
    /// Empty selection is deliberately empty. The adapter must never turn it into EventKit's nil/all query.
    static func agenda(events: [CalendarAgendaEvent], selectedCalendarIDs: Set<String>,
                       excludingCalendarIDs: Set<String> = [], in range: DateInterval) -> [CalendarAgendaEvent] {
        guard range.duration > 0 else { return [] }
        var latest: [[String]: CalendarAgendaEvent] = [:]
        var conflicting = Set<[String]>()
        for event in events where event.isValid {
            if let prior = latest[event.identity] {
                if prior.updatedAt > event.updatedAt { continue }
                if prior.updatedAt == event.updatedAt {
                    if prior != event { conflicting.insert(event.identity) }
                    continue
                }
            }
            conflicting.remove(event.identity)
            latest[event.identity] = event
        }
        return latest.values.filter {
            $0.isValid && !conflicting.contains($0.identity) && !$0.isCancelled && selectedCalendarIDs.contains($0.calendarID)
                && !excludingCalendarIDs.contains($0.calendarID) && $0.start < range.end && $0.end > range.start
        }.sorted {
            if $0.start != $1.start { return $0.start < $1.start }
            return $0.identity.lexicographicallyPrecedes($1.identity)
        }
    }
    static func sourceID(deviceID: UUID) -> String { "eventkit:" + deviceID.uuidString }

    /// Apply a complete, successful bounded query. Never call this with partial/error results.
    /// Selection changes remove all deselected local evidence; a refresh replaces only its queried window.
    @discardableResult
    static func replaceSnapshot(events: [CalendarAgendaEvent], selectedCalendarIDs: Set<String>,
                                excludingCalendarIDs: Set<String> = [], in range: DateInterval,
                                fetchedAt: Date, deviceID: UUID, into ledger: inout TimelineLedger,
                                lastAppliedAt: Date? = nil) throws -> Bool {
        guard fetchedAt.timeIntervalSince1970.isFinite, range.duration > 0,
              range.start.timeIntervalSince1970.isFinite, range.end.timeIntervalSince1970.isFinite,
              events.allSatisfy(\.isValid) else { throw TimelineError.invalidInterval }
        guard lastAppliedAt.map({ fetchedAt >= $0 }) ?? true else { return false }
        let selected = selectedCalendarIDs.subtracting(excludingCalendarIDs)
        let source = sourceID(deviceID: deviceID)
        let incoming = agenda(events: events, selectedCalendarIDs: selected, in: range).map { event in
            let metadata = CalendarEvidenceMetadata(sourceID: source, calendarID: event.calendarID,
                eventID: event.id, occurrenceID: event.occurrenceID, updatedAt: event.updatedAt,
                timeZoneID: event.timeZoneID, isAllDay: event.isAllDay, cancelled: false)
            return ContextEvidence(id: evidenceID(["connected-calendar"] + metadata.identity), deviceID: deviceID,
                source: .calendar, start: event.start, end: event.end, recordedAt: fetchedAt,
                label: String(event.title.prefix(120)), coarseLatitude: nil, coarseLongitude: nil,
                uncertaintyMeters: nil, calendar: metadata)
        }
        let incomingIDs = Set(incoming.map(\.id))
        var updated = ledger
        updated.evidence.removeAll { evidence in
            guard evidence.deviceID == deviceID, let metadata = evidence.calendar,
                  metadata.sourceID == source else { return false }
            return !selected.contains(metadata.calendarID) || incomingIDs.contains(evidence.id)
                || (evidence.start < range.end && (evidence.end ?? evidence.start) > range.start)
        }
        for evidence in incoming {
            if let prior = ledger.evidence.first(where: { $0.id == evidence.id }),
               let priorVersion = prior.calendar?.updatedAt, let version = evidence.calendar?.updatedAt,
               priorVersion > version {
                try updated.addEvidence(prior)
            } else { try updated.addEvidence(evidence) }
        }
        ledger = updated
        return true
    }

    /// Disconnect/revocation/startup clears this collector's cached plans, not imported or other-device evidence.
    static func clearSnapshot(deviceID: UUID, into ledger: inout TimelineLedger) {
        let source = sourceID(deviceID: deviceID)
        ledger.evidence.removeAll { $0.deviceID == deviceID && $0.calendar?.sourceID == source }
    }

    static let actualsCalendarTitle = "Deep Focus — Actuals"

    /// This marker identifies app-created records; it is not authorization to overwrite unrelated events.
    static func isOwnedActualsMarker(_ marker: String) -> Bool {
        let parts = marker.split(separator: ":", omittingEmptySubsequences: false)
        return parts.count == 4 && parts[0] == "deepfocus-actuals" && parts[1] == "v1"
            && UUID(uuidString: String(parts[2])) != nil && UUID(uuidString: String(parts[3])) != nil
    }

    /// Observation transitions must not split one confirmed calendar activity into many events.
    /// Unknown or merely observed slices break the run even if their categories happen to match.
    static func actualsDrafts(from slices: [TimelineSlice], deviceID: UUID) -> [CalendarActualsDraft] {
        var runs: [(start: Date, end: Date, categories: [ActivityCategory])] = []
        var previousCategories: Set<ActivityCategory>?
        for slice in slices.sorted(by: { $0.start == $1.start ? $0.end < $1.end : $0.start < $1.start }) {
            guard slice.basis == .confirmed, slice.start.timeIntervalSince1970.isFinite,
                  slice.end.timeIntervalSince1970.isFinite, slice.end > slice.start,
                  !slice.categories.isEmpty, !slice.categories.contains(.unknown) else {
                previousCategories = nil
                continue
            }
            let categories = Set(slice.categories)
            if previousCategories == categories, let last = runs.last, last.end == slice.start {
                runs[runs.count - 1].end = slice.end
            } else { runs.append((slice.start, slice.end, slice.categories)) }
            previousCategories = categories
        }
        // Coalesce at ledger precision first; only the published event is rounded to whole seconds.
        return runs.compactMap { actualsDraft(start: $0.start, end: $0.end, categories: $0.categories, deviceID: deviceID) }
    }

    /// Caller supplies only confirmed slices. No context, locations, attendees, or URLs enter the draft.
    static func actualsDraft(start: Date, end: Date, categories: [ActivityCategory],
                             deviceID: UUID) -> CalendarActualsDraft? {
        guard start.timeIntervalSince1970.isFinite, end.timeIntervalSince1970.isFinite,
              end > start, !categories.isEmpty, !categories.contains(.unknown) else { return nil }
        let start = Date(timeIntervalSince1970: start.timeIntervalSince1970.rounded())
        let end = Date(timeIntervalSince1970: end.timeIntervalSince1970.rounded())
        guard end > start else { return nil }
        let selected = Set(categories)
        let title = ActivityCategory.allCases.filter { selected.contains($0) }.map(\.title).joined(separator: " + ")
        let interval = evidenceID([deviceID.uuidString, String(start.timeIntervalSince1970), String(end.timeIntervalSince1970)])
        return CalendarActualsDraft(title: title, start: start, end: end,
            marker: "deepfocus-actuals:v1:" + deviceID.uuidString + ":" + interval.uuidString)
    }
}

struct CalendarActualsDraft: Equatable {
    let title: String
    let start: Date
    let end: Date
    let marker: String
}
