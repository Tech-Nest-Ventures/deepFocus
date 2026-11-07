import Foundation

struct QuietTrialEntry: Codable, Identifiable {
    var id = UUID()
    var date = Date()
    var sessionID: UUID?
    var event: String
    var details: [String: String]
}

/// Only explicit usability metrics. No frames, landmarks, camera IDs, URLs or inferred activities.
struct QuietTrialLog: Codable {
    var schemaVersion = 1
    var entries: [QuietTrialEntry] = []
    var delivered: [Date] = []
    var blockedConfiguration: String?
    static var fileURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("QuietDesktopExperiment", isDirectory: true).appendingPathComponent("trial.json")
    }
    static func load() throws -> QuietTrialLog {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return QuietTrialLog() }
        let log = try JSONDecoder().decode(QuietTrialLog.self, from: Data(contentsOf: fileURL))
        guard log.schemaVersion == 1 else { throw CocoaError(.fileReadCorruptFile) }
        return log
    }
    func save() throws {
        try FileManager.default.createDirectory(at: Self.fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(self).write(to: Self.fileURL, options: .atomic)
    }
}
