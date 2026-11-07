import Foundation

/// Explicit local-file import. Calendar plans are context, never observations or confirmations.
enum CalendarImport {
    enum ImportError: LocalizedError {
        case invalidFile, invalidEvent(Int, String)
        var errorDescription: String? {
            switch self {
            case .invalidFile: return "Choose a calendar snapshot with source, fetched_at, and events fields (up to 5 MB)."
            case let .invalidEvent(index, reason): return "Calendar event \(index + 1): \(reason)"
            }
        }
    }

    static func decode(_ data: Data, deviceID: UUID, existingEvidence: [ContextEvidence] = [],
                       defaultTimeZone: TimeZone = TimeZone(identifier: "America/New_York")!) throws -> [ContextEvidence] {
        guard data.count <= 5_000_000,
              let file = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let source = text(file, "source"), let fetched = text(file, "fetched_at"),
              let recordedAt = parseDate(fetched, timeZone: defaultTimeZone),
              let events = file["events"] as? [[String: Any]] else { throw ImportError.invalidFile }
        var result: [ContextEvidence] = []
        for (index, event) in events.enumerated() {
            guard let calendar = text(event, "calendarID", "calendarId", "calendar_id", "calendarName") else {
                throw ImportError.invalidEvent(index, "A calendar identifier or name is required.")
            }
            let cancelled = text(event, "status") == "cancelled" || event["cancelled"] as? Bool == true
            let startText = timestamp(event["start"])
            let endText = timestamp(event["end"])
            for key in ["start", "end"] {
                if let value = event[key], !(value is NSNull), timestamp(value) == nil {
                    throw ImportError.invalidEvent(index, "A date field is malformed.")
                }
            }
            if let startText, let endText, (startText.count == 10) != (endText.count == 10) {
                throw ImportError.invalidEvent(index, "All-day events require date-only start and exclusive end dates.")
            }
            let startObject = event["start"] as? [String: Any] ?? [:]
            let endObject = event["end"] as? [String: Any] ?? [:]
            let timeZoneID = text(startObject, "timeZone") ?? text(event, "timeZone", "timezone") ?? defaultTimeZone.identifier
            guard let timeZone = TimeZone(identifier: timeZoneID),
                  let endTimeZone = TimeZone(identifier: text(endObject, "timeZone") ?? timeZoneID) else {
                throw ImportError.invalidEvent(index, "The time zone is not recognized.")
            }
            let seriesID = text(event, "recurring_event_id", "recurringEventId")
            let suppliedID = text(event, "id", "eventID", "eventId")
            let eventID = seriesID ?? suppliedID ?? evidenceID([source, calendar,
                startText ?? "", endText ?? "", text(event, "summary") ?? ""]).uuidString
            let originalStart = timestamp(event["originalStartTime"] ?? event["originalStart"]
                ?? (event["occurrence"] as? [String: Any])?["originalStart"])
            let occurrenceID: String
            if let originalStart {
                guard let originalDate = parseDate(originalStart, timeZone: timeZone) else {
                    throw ImportError.invalidEvent(index, "The original occurrence start is invalid.")
                }
                occurrenceID = String(originalDate.timeIntervalSince1970)
            } else { occurrenceID = seriesID == nil ? "single" : suppliedID ?? startText ?? "" }
            let prior = (existingEvidence + result).filter {
                $0.calendar?.sourceID == source && $0.calendar?.calendarID == calendar
                    && $0.calendar?.eventID == eventID && $0.calendar?.occurrenceID == occurrenceID
            }.max { $0.calendar!.updatedAt < $1.calendar!.updatedAt }
            let start: Date
            let end: Date
            if let startText, let endText,
               let parsedStart = parseDate(startText, timeZone: timeZone),
               let parsedEnd = parseDate(endText, timeZone: endTimeZone), parsedEnd > parsedStart {
                start = parsedStart; end = parsedEnd
            } else if cancelled, startText == nil, endText == nil, let prior, let priorEnd = prior.end {
                start = prior.start; end = priorEnd
            } else {
                throw ImportError.invalidEvent(index, cancelled
                    ? "A cancellation needs valid dates or a previously imported matching event."
                    : "Valid start/end times are required; ambiguous daylight-saving times need an explicit UTC offset.")
            }
            let label = String((text(event, "summary") ?? prior?.label ?? "Calendar intention").prefix(120))
            guard let updatedAt = parseDate(text(event, "updated", "updated_at") ?? fetched, timeZone: defaultTimeZone) else {
                throw ImportError.invalidEvent(index, "The update timestamp is invalid.")
            }
            let metadata = CalendarEvidenceMetadata(sourceID: source, calendarID: calendar, eventID: eventID,
                occurrenceID: occurrenceID, updatedAt: updatedAt, timeZoneID: startText == nil ? prior?.calendar?.timeZoneID ?? timeZoneID : timeZoneID,
                isAllDay: startText.map { $0.count == 10 } ?? prior?.calendar?.isAllDay ?? false, cancelled: cancelled)
            let observation = ContextEvidence(id: evidenceID(["calendar"] + metadata.identity), deviceID: deviceID,
                source: .calendar, start: start, end: end, recordedAt: recordedAt, label: label,
                coarseLatitude: nil, coarseLongitude: nil, uncertaintyMeters: nil, calendar: metadata)
            guard observation.isValid else { throw ImportError.invalidEvent(index, "Invalid calendar metadata.") }
            if let duplicate = result.firstIndex(where: { $0.calendar?.identity == metadata.identity }) {
                let previous = result[duplicate]
                if metadata.updatedAt == previous.calendar!.updatedAt {
                    guard previous.start == observation.start, previous.end == observation.end,
                          previous.label == observation.label, previous.calendar == observation.calendar else {
                        throw ImportError.invalidEvent(index, "Conflicting versions of the same calendar event.")
                    }
                } else if metadata.updatedAt > previous.calendar!.updatedAt { result[duplicate] = observation }
            } else { result.append(observation) }
        }
        return result
    }

    /// Offers intentions for review without creating annotations or claiming the plan happened.
    static func suggestions(in range: DateInterval, evidence: [ContextEvidence]) -> [ContextEvidence] {
        guard range.duration > 0 else { return [] }
        return evidence.filter {
            guard let calendar = $0.calendar, !calendar.cancelled, !calendar.isAllDay, let end = $0.end else { return false }
            return $0.start < range.end && end > range.start
        }.sorted { $0.start == $1.start ? $0.id.uuidString < $1.id.uuidString : $0.start < $1.start }
    }

    private static func timestamp(_ value: Any?) -> String? {
        if let value = value as? String { return value }
        if let value = value as? [String: Any] { return text(value, "dateTime", "date") }
        return nil
    }

    private static func text(_ object: [String: Any], _ keys: String...) -> String? {
        for key in keys {
            if let value = object[key] as? String, !value.isEmpty { return value }
        }
        return nil
    }

    private static func parseDate(_ value: String, timeZone: TimeZone) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: value) { return date }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: value) { return date }
        let local = DateFormatter()
        local.locale = Locale(identifier: "en_US_POSIX")
        local.calendar = Calendar(identifier: .gregorian)
        local.timeZone = timeZone
        local.isLenient = false
        local.dateFormat = value.count == 10 ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm:ss"
        guard let date = local.date(from: value), local.string(from: date) == value else { return nil }
        // Local fall-back times occur twice. Require an offset rather than silently picking one.
        if value.count > 10 {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = timeZone
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
            let anchor = calendar.startOfDay(for: date).addingTimeInterval(-1)
            let first = calendar.nextDate(after: anchor, matching: components, matchingPolicy: .strict, repeatedTimePolicy: .first)
            let last = calendar.nextDate(after: anchor, matching: components, matchingPolicy: .strict, repeatedTimePolicy: .last)
            guard first == last, first == date else { return nil }
        }
        return date
    }
}
