import AppKit
import Combine
import SafariServices
import CoreGraphics

final class MonitorModel: ObservableObject {
    let timeline = TimelineStore()
    let gapNotifications = GapNotificationController()
    @Published private(set) var activity = ActivityState()
    @Published private(set) var appName = "No active application"
    @Published private(set) var appIcon: NSImage?
    @Published private(set) var bridgeError: String? = "Starting browser bridge…"
    @Published var setupMessage: String?
    private var server: BridgeServer?
    private var observers: [(NotificationCenter, NSObjectProtocol)] = []
    private var timer: Timer?
    private var token: String?
    private var suspensionReasons = Set<String>()

    var statusText: String {
        if activity.paused { return "Paused" }
        if activity.suspended { return "Screen inactive" }
        if bridgeError != nil { return "App monitoring · browser bridge unavailable" }
        if activity.browser != nil && activity.url == nil { return "Waiting for a public browser tab" }
        return "Monitoring live"
    }

    init() {
        do {
            let token = try PairingCredential.load()
            self.token = token
            let server = BridgeServer(token: token)
            self.server = server
            server.status = { [weak self] in
                guard let self else { return [:] }
                self.refreshForeground()
                return ["epoch": self.activity.epoch,
                        "monitoring": self.activity.canMonitor,
                        "browser": self.activity.browser?.rawValue as Any? ?? NSNull()]
            }
            server.event = { [weak self] event in
                guard let self else { return false }
                self.refreshForeground()
                var state = self.activity
                let accepted = state.receive(event, now: Date())
                if accepted { self.activity = state; self.sampleTimeline() }
                return accepted
            }
            server.stateChanged = { [weak self] error in self?.bridgeError = error }
            try server.start()
        } catch {
            bridgeError = "Could not start browser bridge. Relaunch the app and check setup."
        }
        let workspace = NSWorkspace.shared.notificationCenter
        observe(workspace, NSWorkspace.didActivateApplicationNotification) { [weak self] in self?.refreshForeground() }
        observe(workspace, NSWorkspace.willSleepNotification) { [weak self] in self?.suspend("sleep", true) }
        observe(workspace, NSWorkspace.didWakeNotification) { [weak self] in self?.suspend("sleep", false) }
        observe(workspace, NSWorkspace.screensDidSleepNotification) { [weak self] in self?.suspend("display", true) }
        observe(workspace, NSWorkspace.screensDidWakeNotification) { [weak self] in self?.suspend("display", false) }
        observe(workspace, NSWorkspace.sessionDidResignActiveNotification) { [weak self] in self?.suspend("session", true) }
        observe(workspace, NSWorkspace.sessionDidBecomeActiveNotification) { [weak self] in self?.suspend("session", false) }
        observe(NotificationCenter.default, NSApplication.willTerminateNotification) { [weak self] in self?.timeline.save() }
        // Supplement workspace session/display notifications for an immediate screen-lock clear.
        let distributed = DistributedNotificationCenter.default()
        observe(distributed, .init("com.apple.screenIsLocked")) { [weak self] in self?.suspend("lock", true) }
        observe(distributed, .init("com.apple.screenIsUnlocked")) { [weak self] in self?.suspend("lock", false) }
        refreshForeground()
        let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.refreshForeground()
            let now = Date()
            if let last = self.activity.lastReceived, now < last || now.timeIntervalSince(last) > ActivityState.freshness {
                self.activity.expire(now: now)
            }
            self.sampleTimeline()
            self.gapNotifications.poll(store: self.timeline, activity: self.activity)
        }
        timer.tolerance = 0.25
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    private func observe(_ center: NotificationCenter, _ name: Notification.Name, action: @escaping () -> Void) {
        observers.append((center, center.addObserver(forName: name, object: nil, queue: .main) { _ in action() }))
    }

    private func suspend(_ reason: String, _ value: Bool) {
        sampleTimeline()
        if value { suspensionReasons.insert(reason) } else { suspensionReasons.remove(reason) }
        activity.setSuspended(!suspensionReasons.isEmpty)
        activity.setForeground(nil)
        refreshForeground()
        timeline.save()
    }

    func refreshForeground() {
        defer { sampleTimeline() }
        guard activity.canMonitor else {
            appName = activity.paused ? "Monitoring paused" : "Screen inactive"
            appIcon = nil
            return
        }
        let app = NSWorkspace.shared.frontmostApplication
        let bundleID = app?.bundleIdentifier
        // Opening the menu-bar panel must not attribute the browser's URL to Deep Focus itself.
        guard bundleID != Bundle.main.bundleIdentifier else {
            activity.setForeground(bundleID)
            appName = "Deep Focus"
            appIcon = app?.icon
            return
        }
        if bundleID != activity.foregroundBundleID {
            activity.setForeground(bundleID)
            appName = app?.localizedName ?? "No active application"
            appIcon = app?.icon
        }
    }

    func togglePause() {
        sampleTimeline()
        activity.setPaused(!activity.paused)
        // Force labels to refresh after resuming into the same application.
        activity.setForeground(nil)
        refreshForeground()
    }

    private func sampleTimeline() {
        let idle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .init(rawValue: ~UInt32(0))!)
        timeline.capture(activity: activity, appName: appName, hasRecentInput: idle.isFinite && idle < 60)
    }

    func copyPairingCode() {
        guard let token else { setupMessage = "Pairing is unavailable. Relaunch Deep Focus."; return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(token, forType: .string)
        setupMessage = "Pairing code copied. Paste it into the browser extension."
        let count = NSPasteboard.general.changeCount
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) {
            if NSPasteboard.general.changeCount == count { NSPasteboard.general.clearContents() }
        }
    }

    func openSafariSettings() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.timeowilliams.DeepFocusNative.Safari") { [weak self] error in
            if error != nil {
                DispatchQueue.main.async {
                    self?.setupMessage = "Open Safari Settings → Extensions. Local unsigned builds may need Safari's Allow Unsigned Extensions development setting."
                }
            }
        }
    }

    deinit {
        timer?.invalidate()
        observers.forEach { $0.0.removeObserver($0.1) }
    }
}
