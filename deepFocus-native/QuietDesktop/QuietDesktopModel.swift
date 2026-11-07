import AppKit
import AVFoundation
import SwiftUI

@MainActor final class QuietDesktopModel: ObservableObject {
    @Published private(set) var policy = QuietSessionPolicy()
    @Published private(set) var message = "Camera is off. Start only when you choose."
    @Published private(set) var captureStopping = false
    @Published private(set) var loggingAvailable = true
    @Published private(set) var trialBlocked = false
    private static let configuration = "quiet-v1"
    @Published var discomfort = 0
    @Published var continuedUse = "Undecided"
    @Published var quiet = false { didSet { policy.setQuiet(quiet); dismissPrompt(); record("quiet", ["enabled": String(quiet)]) } }
    private let camera = QuietCamera()
    private var log = QuietTrialLog()
    private var timer: Timer?
    private var observers: [(NotificationCenter, NSObjectProtocol)] = []
    private var sessionID: UUID?
    private var sessionStarted: Date?
    private var retries = 0
    private var panel: NSPanel?
    private var promptID: UUID?

    init() {
        do {
            log = try QuietTrialLog.load(); policy = QuietSessionPolicy(delivered: log.delivered)
            trialBlocked = log.blockedConfiguration == Self.configuration
            if trialBlocked { message = "An away prompt was reported. This experiment configuration is blocked until repaired." }
        }
        catch { loggingAvailable = false; message = "Trial log could not be read. Existing data is preserved; capture is disabled." }
        camera.observation = { [weak self] observation, geometry, date, generation in
            guard let self, self.policy.generation == generation, self.policy.state != .stopped else { return }
            let oldState = self.policy.state, oldCalibration = self.policy.calibrated
            self.policy.observe(observation, geometry: geometry, at: date, generation: generation)
            self.recordTransitions(from: oldState, calibrated: oldCalibration)
            self.refreshGuidance()
            self.showPromptIfEligible()
        }
        camera.failure = { [weak self] message, generation in
            guard let self, self.policy.generation == generation else { return }
            self.stop(reason: message)
        }
        let workspace = NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.willSleepNotification, NSWorkspace.screensDidSleepNotification, NSWorkspace.sessionDidResignActiveNotification] {
            observe(workspace, name) { [weak self] _ in self?.stop(reason: "System suspended. Press Start for a new session.") }
        }
        observe(DistributedNotificationCenter.default(), Notification.Name("com.apple.screenIsLocked")) { [weak self] _ in self?.stop(reason: "Screen locked. Press Start for a new session.") }
        for name in [AVCaptureSession.wasInterruptedNotification, AVCaptureSession.runtimeErrorNotification] {
            observe(.default, name) { [weak self] _ in self?.stop(reason: "Camera capture interrupted. Press Start to retry.") }
        }
        observe(.default, NSWindow.willCloseNotification) { [weak self] note in
            guard let window = note.object as? NSWindow, window.title == "Quiet Desktop Experiment" else { return }
            self?.stop(reason: "Window closed. Camera is off.")
        }
        observe(.default, NSApplication.willTerminateNotification) { [weak self] _ in self?.stop(reason: "Quit") }
    }
    private func observe(_ center: NotificationCenter, _ name: Notification.Name, handler: @escaping (Notification) -> Void) {
        let token = center.addObserver(forName: name, object: nil, queue: .main) { note in
            MainActor.assumeIsolated { handler(note) }
        }
        observers.append((center, token))
    }
    func start() {
        guard policy.state == .stopped, !captureStopping, loggingAvailable, !trialBlocked else { return }
        sessionID = UUID(); sessionStarted = Date(); retries = 0
        let generation = policy.start(at: Date())
        record("start", ["voluntary": "true", "configuration": Self.configuration, "build": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "development"])
        guard loggingAvailable, policy.state != .stopped else { return }
        message = "Requesting camera access. Stop cancels this session."
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: beginCapture(generation)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                Task { @MainActor in
                    guard let self, self.policy.generation == generation, self.policy.state != .stopped else { return }
                    if granted { self.beginCapture(generation) } else { self.stop(reason: "Camera permission was denied. Enable it in System Settings, then press Start.") }
                }
            }
        default: stop(reason: "Camera permission is unavailable. Check System Settings, then press Start.")
        }
    }
    private func beginCapture(_ generation: UInt64) {
        guard policy.generation == generation, policy.state != .stopped else { return }
        policy.retryCalibration(at: Date()); camera.start(generation: generation)
        message = "Sit comfortably with your face and both shoulders visible; hold still for calibration."
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }
    func stop(reason: String = "Stopped. Camera is off; Start begins a new session.") {
        let wasRunning = policy.state != .stopped
        if let promptID { record("promptAction", ["promptID": promptID.uuidString, "action": "stop"]) }
        policy.stop(); timer?.invalidate(); timer = nil; dismissPrompt()
        if wasRunning {
            record("stop", ["reason": reason, "durationSeconds": String(Int(Date().timeIntervalSince(sessionStarted ?? Date()))), "retries": String(retries)])
        }
        captureStopping = true
        camera.stop { [weak self] in self?.captureStopping = false }
        message = reason
    }
    func retryCalibration() {
        retries += 1; policy.retryCalibration(at: Date()); dismissPrompt(); record("calibrationRetry", ["retry": String(retries)]); refreshGuidance()
    }
    func snooze() {
        policy.snooze(at: Date())
        var details = ["minutes": "15"]
        if let promptID { details["promptID"] = promptID.uuidString }
        record("snooze", details); dismissPrompt()
    }
    private func tick() {
        guard policy.state != .stopped else { return }
        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else { stop(reason: "Camera permission was lost."); return }
        let oldState = policy.state, oldCalibration = policy.calibrated
        policy.tick(at: Date()); recordTransitions(from: oldState, calibrated: oldCalibration); refreshGuidance()
        if policy.state != .present || !policy.calibrated { dismissPrompt() }
    }
    private func recordTransitions(from state: QuietPresence, calibrated: Bool) {
        if state != policy.state { record("state", ["state": policy.state.rawValue]) }
        if calibrated != policy.calibrated {
            record("calibration", ["valid": String(policy.calibrated), "setupSeconds": String(Int(Date().timeIntervalSince(sessionStarted ?? Date()))), "retries": String(retries)])
        }
        if policy.state != .present || !policy.calibrated { dismissPrompt() }
    }
    private func refreshGuidance() {
        if policy.calibrationTimedOut { message = "Calibration timed out. Improve lighting and visibility, then Retry calibration." }
        else if policy.state == .away { message = "No person detected in usable frames. Prompts are suppressed." }
        else if policy.state == .uncertain { message = "Insufficient evidence. No scoring or prompts; keep face and both shoulders visible." }
        else if !policy.calibrated { message = "Calibrating a stable, comfortable baseline (at least 5 seconds)." }
        else if quiet { message = "Quiet mode. Prompts are suppressed." }
        else if let until = policy.snoozedUntil, until > Date() { message = "Prompts snoozed until \(until.formatted(date: .omitted, time: .shortened))." }
        else { message = "Baseline ready. Only sustained position changes may prompt." }
    }
    private func showPromptIfEligible() {
        let now = Date()
        guard panel == nil, policy.canDeliverPrompt(at: now), loggingAvailable else { return }
        // Commit rate-limit history before displaying anything; failed writes suppress delivery.
        var candidate = policy
        guard candidate.deliverPrompt(at: now) else { return }
        var updated = log
        let entry = QuietTrialEntry(sessionID: sessionID, event: "promptReserved", details: ["state": policy.state.rawValue, "calibrated": String(policy.calibrated), "feedback": "unrated", "actualPresence": "unknown"])
        updated.entries.append(entry); updated.delivered = candidate.delivered
        do { try updated.save() } catch { loggingAvailable = false; stop(reason: "Could not save trial log; capture stopped."); return }
        log = updated
        // Disk I/O may take longer than the freshness window. Reserve the rate slot
        // conservatively, but never show a prompt based on a stale frame.
        let freshAtDelivery = policy.canDeliverPrompt(at: Date())
        policy = candidate
        guard freshAtDelivery else {
            record("promptCancelled", ["promptID": entry.id.uuidString, "reason": "staleBeforeDisplay"])
            return
        }
        promptID = entry.id
        let prompt = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 420, height: 245), styleMask: [.titled, .nonactivatingPanel], backing: .buffered, defer: false)
        prompt.title = "Position check"; prompt.level = .floating; prompt.isReleasedWhenClosed = false
        prompt.contentView = NSHostingView(rootView: QuietPromptView(model: self))
        if let frame = NSScreen.main?.visibleFrame { prompt.setFrameOrigin(NSPoint(x: frame.maxX - 440, y: frame.maxY - 280)) }
        panel = prompt; prompt.orderFrontRegardless()
        record("promptDisplayed", ["promptID": entry.id.uuidString])
    }
    func feedback(_ rating: String, presence: String) {
        guard recordPromptFeedback(rating, presence: presence) else { return }
        if trialBlocked { stopForAwayPrompt() } else { dismissPrompt() }
    }
    func snoozePrompt(presence: String) {
        guard recordPromptFeedback("unrated", presence: presence) else { return }
        if trialBlocked { stopForAwayPrompt() } else { snooze() }
    }
    func stopPrompt(presence: String) {
        guard recordPromptFeedback("unrated", presence: presence) else { return }
        if trialBlocked { stopForAwayPrompt() } else { stop() }
    }
    /// Persist presence and the configuration gate before any action dismisses the prompt.
    /// Returning false preserves fail-closed behavior if the log write itself stopped capture.
    private func recordPromptFeedback(_ rating: String, presence: String) -> Bool {
        guard let promptID else { return false }
        if presence == "away" { trialBlocked = true; log.blockedConfiguration = Self.configuration }
        record("promptFeedback", ["promptID": promptID.uuidString, "feedback": rating, "actualPresence": presence])
        return loggingAvailable
    }
    private func stopForAwayPrompt() {
        stop(reason: "Away prompt reported. This configuration is blocked until the cause is repaired; do not continue the trial.")
    }
    private func dismissPrompt() { panel?.orderOut(nil); panel = nil; promptID = nil }
    func saveReview() { record("review", ["cameraDiscomfort": String(discomfort), "voluntaryContinuedUse": continuedUse]); message = "Review saved locally. Five working days have not been evaluated automatically." }
    func exportLog() {
        let picker = NSSavePanel(); picker.nameFieldStringValue = "quiet-desktop-trial.json"; picker.allowedContentTypes = [.json]
        guard picker.runModal() == .OK, let url = picker.url else { return }
        do { try JSONEncoder().encode(log).write(to: url, options: .atomic) } catch { message = "Could not export trial log." }
    }
    private func record(_ event: String, _ details: [String: String]) {
        guard loggingAvailable else { return }
        log.entries.append(QuietTrialEntry(sessionID: sessionID, event: event, details: details))
        do { try log.save() } catch {
            loggingAvailable = false
            // Fail closed without recursively trying to log another event.
            policy.stop(); timer?.invalidate(); timer = nil; dismissPrompt()
            captureStopping = true
            camera.stop { [weak self] in self?.captureStopping = false }
            message = "Could not save trial log. Capture stopped; existing file is preserved."
        }
    }
}
