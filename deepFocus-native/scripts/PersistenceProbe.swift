import Foundation

/// Exercises the actual shared persistence class using only a disposable temporary directory.
@main
struct PersistenceProbe {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("deepfocus-persistence-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appendingPathComponent("timeline.json")
        let now = Date()
        let store = TimelineStore(fileOverride: file)
        store.annotate(start: now.addingTimeInterval(-60), end: now, categories: [.family, .walking])
        guard store.errorMessage == nil else { throw TimelineError.invalidArchive }
        let reopened = TimelineStore(fileOverride: file)
        guard reopened.ledger.annotations.count == 1, reopened.ledger.annotations[0].categories == [.walking, .family] else {
            throw TimelineError.invalidArchive
        }
        let permissions = try FileManager.default.attributesOfItem(atPath: file.path)[.posixPermissions] as? NSNumber
        guard permissions?.intValue == 0o600 else { throw TimelineError.invalidArchive }
        print("Actual local store write/reopen and owner-only permissions: PASS")
        let exchange = try TimelineExchange.decode(reopened.exportExchange())
        var phone = TimelineLedger()
        try exchange.merge(into: &phone)
        guard phone.annotations.count == 1, phone.annotations[0].categories == [.walking, .family] else { throw TimelineError.invalidArchive }
        print("Actual store export and cross-device evidence merge: PASS")
        let current = try Data(contentsOf: file)
        var legacy = try JSONSerialization.jsonObject(with: current) as! [String: Any]
        var legacyAnnotations = legacy["annotations"] as! [[String: Any]]
        legacyAnnotations[0].removeValue(forKey: "categories")
        legacyAnnotations[0]["category"] = "family"
        legacy["annotations"] = legacyAnnotations
        for version in [1, 2] {
            legacy["schemaVersion"] = version
            let original = try JSONSerialization.data(withJSONObject: legacy)
            try original.write(to: file)
            let upgraded = TimelineStore(fileOverride: file)
            guard upgraded.ledger.schemaVersion == 3, upgraded.ledger.annotations[0].categories == [.family] else {
                throw TimelineError.invalidArchive
            }
            upgraded.save()
            guard try Data(contentsOf: file.appendingPathExtension("v\(version)-backup")) == original,
                  try TimelineArchive.decode(Data(contentsOf: file)).schemaVersion == 3 else { throw TimelineError.invalidArchive }
            print("V\(version) original backup and v3 store migration: PASS")
        }
        let upgraded = TimelineStore(fileOverride: file)
        let beforeInvalidImport = try Data(contentsOf: file)
        upgraded.importCalendar(Data(#"{"source":"fixture","fetched_at":"2026-11-07T12:00:00Z","events":[{"calendarID":"work","id":"invalid","start":"2026-11-01T01:30:00","end":"2026-11-01T02:30:00"}]}"#.utf8))
        guard upgraded.errorMessage?.contains("Calendar event 1") == true,
              try Data(contentsOf: file) == beforeInvalidImport else { throw TimelineError.invalidArchive }
        print("Calendar import diagnostics and atomic preservation: PASS")
        // An unrelated existing backup must never be replaced or allow destructive migration.
        legacy["startedAt"] = 1_700_000_000_000
        let conflictingLegacy = try JSONSerialization.data(withJSONObject: legacy)
        try conflictingLegacy.write(to: file)
        let conflictingStore = TimelineStore(fileOverride: file)
        conflictingStore.save()
        guard conflictingStore.errorMessage != nil, try Data(contentsOf: file) == conflictingLegacy else {
            throw TimelineError.invalidArchive
        }
        print("Conflicting migration backup preserves original without overwrite: PASS")
        var future = legacy
        future["schemaVersion"] = 99
        let futureData = try JSONSerialization.data(withJSONObject: future)
        try futureData.write(to: file)
        let futureStore = TimelineStore(fileOverride: file)
        futureStore.save()
        guard futureStore.errorMessage != nil, try Data(contentsOf: file) == futureData else { throw TimelineError.invalidArchive }
        print("Future archive preserved without overwrite: PASS")
        let corrupt = Data("synthetic invalid archive".utf8)
        try corrupt.write(to: file)
        let protectedStore = TimelineStore(fileOverride: file)
        protectedStore.annotate(start: now.addingTimeInterval(-60), end: now, category: .reading)
        protectedStore.save()
        guard protectedStore.errorMessage != nil, try Data(contentsOf: file) == corrupt else { throw TimelineError.invalidArchive }
        print("Corrupt archive preserved without overwrite: PASS")
    }
}
