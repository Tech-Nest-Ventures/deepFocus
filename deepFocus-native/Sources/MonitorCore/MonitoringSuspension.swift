/// Combines independent OS suspension signals. A wake only clears its own reason.
/// AppKit notification adapters and deterministic tests use this same boundary.
struct MonitoringSuspension {
    enum Reason: CaseIterable { case lock, sleep, display, session }
    private var reasons = Set<Reason>()

    /// Returns true only when the app must refresh foreground labels and persist a boundary.
    /// Duplicate or unmatched notifications must not invalidate a current browser report.
    @discardableResult
    mutating func set(_ reason: Reason, active: Bool, activity: inout ActivityState) -> Bool {
        if active { reasons.insert(reason) } else { reasons.remove(reason) }
        let suspended = !reasons.isEmpty
        guard suspended != activity.suspended else { return false }
        activity.setSuspended(suspended)
        activity.setForeground(nil)
        return true
    }
}
