import Foundation
import Combine

final class TimelineStore: ObservableObject {
    @Published private(set) var ledger: TimelineLedger
    @Published private(set) var recordingEnabled: Bool
    @Published var errorMessage: String?
    private var recorder = DurationRecorder()
    private var lastSave = Date.distantPast
    private let file: URL?
    private var writable = true

    init(fileOverride: URL? = nil) {
        recordingEnabled = UserDefaults.standard.bool(forKey: "saveLocalTimeline")
        let directory = fileOverride == nil ? try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                     appropriateFor: nil, create: true)
            .appendingPathComponent("DeepFocusNative", isDirectory: true) : nil
        file = fileOverride ?? directory?.appendingPathComponent("timeline-v1.json")
        ledger = TimelineLedger()
        if let file, FileManager.default.fileExists(atPath: file.path) {
            do { ledger = try TimelineArchive.decode(Data(contentsOf: file)) }
            catch {
                writable = false
                recordingEnabled = false
                errorMessage = "The saved timeline could not be read. It has been preserved; new records will not overwrite it."
            }
        }
    }

    func setRecording(_ value: Bool) {
        guard writable else { return }
        recorder.sample(nil, wall: Date(), uptime: ProcessInfo.processInfo.systemUptime, into: &ledger)
        recorder.reset()
        recordingEnabled = value
        UserDefaults.standard.set(value, forKey: "saveLocalTimeline")
        if value && ledger.intervals.isEmpty && ledger.annotations.isEmpty { ledger.startedAt = Date() }
        save()
    }

    func capture(activity: ActivityState, appName: String, hasRecentInput: Bool) {
        guard recordingEnabled, writable else { return }
        let context = activity.canMonitor ? activity.foregroundBundleID.map {
            DesktopContext(bundleID: $0, appName: appName, url: activity.url, hasRecentInput: hasRecentInput)
        } : nil
        let now = Date()
        recorder.sample(context, wall: now, uptime: ProcessInfo.processInfo.systemUptime, into: &ledger)
        if now.timeIntervalSince(lastSave) >= 30 { save() }
    }

    func annotate(start: Date, end: Date, category: ActivityCategory) {
        guard writable else { return }
        do {
            try ledger.annotate(start: start, end: end, category: category, now: Date())
            ledger.startedAt = min(ledger.startedAt, start)
            save()
        } catch { errorMessage = "Choose an interval that ends after its start and no later than now." }
    }

    func addEvidence(_ evidence: ContextEvidence) {
        guard writable else { return }
        do { try ledger.addEvidence(evidence); save() }
        catch { errorMessage = "The observation could not be recorded." }
    }

    func quiet(for duration: TimeInterval) {
        ledger.quietUntil = Date().addingTimeInterval(duration)
        save()
    }

    func resumeReviews() { ledger.quietUntil = nil; save() }

    func importExchange(_ data: Data) {
        guard writable else { return }
        do {
            let exchange = try TimelineExchange.decode(data)
            exchange.merge(into: &ledger)
            save()
        } catch { errorMessage = "This file is not a supported Deep Focus evidence export. Existing records were preserved." }
    }

    func exportExchange() throws -> Data {
        try TimelineExchange(annotations: ledger.annotations, evidence: ledger.evidence, quietUntil: ledger.quietUntil).encode()
    }

    func save() {
        guard writable else { return }
        guard let file else { errorMessage = "Local storage is unavailable. Current records remain in memory."; return }
        do {
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true,
                                                    attributes: [.posixPermissions: 0o700])
            let data = try TimelineArchive.encode(ledger)
            try data.write(to: file, options: .atomic)
            var attributes: [FileAttributeKey: Any] = [.posixPermissions: 0o600]
            #if os(iOS)
            attributes[.protectionKey] = FileProtectionType.completeUntilFirstUserAuthentication
            #endif
            try FileManager.default.setAttributes(attributes, ofItemAtPath: file.path)
            lastSave = Date()
            errorMessage = nil
        } catch { errorMessage = "Could not save the local timeline. Current observations remain in memory." }
    }
}
