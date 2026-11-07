import Foundation
import CryptoKit

struct AgentFileEvent: Codable, Equatable {
    let sourceID: String
    let eventID: String
    let taskID: String
    let runID: String
    let deviceID: UUID
    let timestamp: Date
    let kind: AgentEventMetadata.Kind
    let label: String
    let resultReference: String?

    var observation: ContextEvidence {
        let metadata = AgentEventMetadata(sourceID: sourceID, eventID: eventID, taskID: taskID,
                                          runID: runID, kind: kind, resultReference: resultReference)
        return ContextEvidence(id: evidenceID([deviceID.uuidString, sourceID, eventID]), deviceID: deviceID,
            source: .agentTask, start: timestamp, end: nil, recordedAt: timestamp, label: label,
            coarseLatitude: nil, coarseLongitude: nil, uncertaintyMeters: nil, agent: metadata)
    }
}

/// Stable namespaced identity; JSON framing avoids ambiguous concatenation.
func evidenceID(_ components: [String]) -> UUID {
    let data = (try? JSONEncoder().encode(components)) ?? Data()
    var bytes = Array(SHA256.hash(data: data).prefix(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x50
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                       bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
}

struct AgentEventFile: Codable {
    var schemaVersion = 1
    let events: [AgentFileEvent]

    func encode() throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(self)
    }

    static func decode(_ data: Data) throws -> [ContextEvidence] {
        guard data.count <= 5_000_000 else { throw TimelineError.invalidArchive }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        let file = try decoder.decode(Self.self, from: data)
        guard file.schemaVersion == 1 else { throw TimelineError.incompatibleVersion }
        var events: [UUID: AgentFileEvent] = [:]
        for event in file.events {
            let evidence = event.observation
            guard evidence.isValid else { throw TimelineError.invalidArchive }
            if let previous = events[evidence.id], previous != event { throw TimelineError.invalidArchive }
            events[evidence.id] = event
        }
        return events.values.map(\.observation).sorted { $0.start < $1.start }
    }
}

struct AgentRunSummary: Identifiable {
    let id: UUID
    let taskID: String
    let runID: String
    let label: String
    let runtime: TimeInterval?
    let reviewed: Bool
    let accepted: Bool
    let resultReference: String?
    let lastEvent: Date

    static func summaries(in evidence: [ContextEvidence]) -> [AgentRunSummary] {
        let events = evidence.filter { $0.agent != nil }
        let groups = Dictionary(grouping: events) { item -> UUID in
            let event = item.agent!
            return evidenceID([item.deviceID.uuidString, event.sourceID, event.taskID, event.runID])
        }
        return groups.map { id, items in
            let ordered = items.sorted { $0.start < $1.start }
            let last = ordered.last!
            let event = last.agent!
            let starts = ordered.filter { $0.agent?.kind == .started }
            let finishes = ordered.filter { $0.agent?.kind == .finished }
            let runtime: TimeInterval?
            if starts.count == 1, finishes.count == 1, finishes[0].start >= starts[0].start {
                let duration = finishes[0].start.timeIntervalSince(starts[0].start)
                runtime = duration.isFinite && duration < Double(Int.max) ? duration : nil
            } else { runtime = nil }
            return AgentRunSummary(id: id, taskID: event.taskID, runID: event.runID, label: last.label,
                runtime: runtime, reviewed: ordered.contains { $0.agent?.kind == .reviewed },
                accepted: ordered.contains { $0.agent?.kind == .accepted },
                resultReference: ordered.reversed().compactMap { $0.agent?.resultReference }.first,
                lastEvent: last.start)
        }.sorted { $0.lastEvent > $1.lastEvent }
    }
}
