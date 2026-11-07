import Foundation

/// Calendar records are intentions, including cancellation tombstones.
struct CalendarEvidenceMetadata: Codable, Equatable {
    let sourceID: String
    let calendarID: String
    let eventID: String
    let occurrenceID: String
    let updatedAt: Date
    let timeZoneID: String
    let isAllDay: Bool
    let cancelled: Bool

    var identity: [String] { [sourceID, calendarID, eventID, occurrenceID] }
    var isValid: Bool {
        identity.allSatisfy { !$0.isEmpty && $0.count <= 512 }
            && updatedAt.timeIntervalSince1970.isFinite && TimeZone(identifier: timeZoneID) != nil
    }
}

struct AgentEventMetadata: Codable, Equatable {
    enum Kind: String, Codable { case started, finished, reviewed, accepted }
    let sourceID: String
    let eventID: String
    let taskID: String
    let runID: String
    let kind: Kind
    let resultReference: String?

    var identity: [String] { [sourceID, eventID] }
    var isValid: Bool {
        [sourceID, eventID, taskID, runID].allSatisfy { !$0.isEmpty && $0.count <= 512 }
            && (resultReference.map { $0.count <= 2048 } ?? true)
    }
}
