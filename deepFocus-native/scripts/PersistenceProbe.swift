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
        store.annotate(start: now.addingTimeInterval(-60), end: now, category: .family)
        guard store.errorMessage == nil else { throw TimelineError.invalidArchive }
        let reopened = TimelineStore(fileOverride: file)
        guard reopened.ledger.annotations.count == 1, reopened.ledger.annotations[0].category == .family else {
            throw TimelineError.invalidArchive
        }
        let permissions = try FileManager.default.attributesOfItem(atPath: file.path)[.posixPermissions] as? NSNumber
        guard permissions?.intValue == 0o600 else { throw TimelineError.invalidArchive }
        print("Actual local store write/reopen and owner-only permissions: PASS")
        let exchange = try TimelineExchange.decode(reopened.exportExchange())
        var phone = TimelineLedger()
        exchange.merge(into: &phone)
        guard phone.annotations.count == 1 else { throw TimelineError.invalidArchive }
        print("Actual store export and cross-device evidence merge: PASS")
        let corrupt = Data("synthetic invalid archive".utf8)
        try corrupt.write(to: file)
        let protectedStore = TimelineStore(fileOverride: file)
        protectedStore.annotate(start: now.addingTimeInterval(-60), end: now, category: .reading)
        protectedStore.save()
        guard protectedStore.errorMessage != nil, try Data(contentsOf: file) == corrupt else { throw TimelineError.invalidArchive }
        print("Corrupt archive preserved without overwrite: PASS")
    }
}
