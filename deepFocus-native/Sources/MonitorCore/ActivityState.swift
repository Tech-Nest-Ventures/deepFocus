import Foundation

enum SupportedBrowser: String, Codable, CaseIterable {
    case safari, chrome, edge

    var bundleID: String {
        switch self {
        case .safari: return "com.apple.Safari"
        case .chrome: return "com.google.Chrome"
        case .edge: return "com.microsoft.edgemac"
        }
    }

    init?(bundleID: String) {
        guard let browser = Self.allCases.first(where: { $0.bundleID == bundleID }) else { return nil }
        self = browser
    }
}

struct BrowserEvent: Codable {
    let browser: SupportedBrowser
    let epoch: String
    let sequence: Int
    let observedAt: Double // Unix milliseconds; used only to reject delayed messages.
    let focused: Bool
    let privateBrowsing: Bool
    let url: String?
}

/// A single in-memory observation, never a history. All mutation runs on the main queue.
struct ActivityState {
    static let freshness: TimeInterval = 6
    private(set) var foregroundBundleID: String?
    private(set) var epoch = UUID().uuidString
    private(set) var paused = false
    private(set) var suspended = false
    private(set) var url: String?
    private(set) var lastReceived: Date?
    private var lastSequence = -1
    private var lastObserved: Double = 0

    var browser: SupportedBrowser? {
        foregroundBundleID.flatMap(SupportedBrowser.init(bundleID:))
    }

    var canMonitor: Bool { !paused && !suspended }

    mutating func setForeground(_ bundleID: String?) {
        guard foregroundBundleID != bundleID else { return }
        foregroundBundleID = bundleID
        invalidate()
    }

    mutating func setPaused(_ value: Bool) {
        paused = value
        invalidate()
    }

    mutating func setSuspended(_ value: Bool) {
        suspended = value
        invalidate()
    }

    mutating func invalidate() {
        epoch = UUID().uuidString
        url = nil
        lastReceived = nil
        lastSequence = -1
        lastObserved = 0
    }

    @discardableResult
    mutating func receive(_ event: BrowserEvent, now: Date) -> Bool {
        let age = now.timeIntervalSince1970 - event.observedAt / 1000
        guard canMonitor, event.browser == browser, event.epoch == epoch,
              event.sequence >= 0, event.sequence > lastSequence,
              event.observedAt.isFinite, event.observedAt >= lastObserved,
              age >= -1, age <= 5 else { return false }

        lastSequence = event.sequence
        lastObserved = event.observedAt
        lastReceived = now
        // An explicit unavailable/private/unfocused report immediately clears the previous URL.
        url = event.focused && !event.privateBrowsing ? Self.displayURL(event.url) : nil
        return true
    }

    mutating func expire(now: Date) {
        if let lastReceived, now.timeIntervalSince(lastReceived) > Self.freshness || now < lastReceived {
            invalidate()
        }
    }

    static func displayURL(_ raw: String?) -> String? {
        guard let raw, raw.utf8.count <= 8192,
              !raw.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }),
              var parts = URLComponents(string: raw),
              ["http", "https"].contains(parts.scheme?.lowercased() ?? ""),
              let host = parts.host, !host.isEmpty else { return nil }
        // Credentials embedded in a URL must never appear in the popover.
        parts.user = nil
        parts.password = nil
        return parts.string
    }
}
