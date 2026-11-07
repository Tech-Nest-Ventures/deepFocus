import Foundation
import Combine
import UserNotifications

final class GapNotificationController: ObservableObject {
    @Published private(set) var enabled = UserDefaults.standard.bool(forKey: "gapNotificationsEnabled")
    @Published private(set) var message: String?
    private var policy: ReviewNotificationPolicy
    private var lastCheck = Date.distantPast

    init() {
        policy = UserDefaults.standard.data(forKey: "gapNotificationPolicy")
            .flatMap { try? JSONDecoder().decode(ReviewNotificationPolicy.self, from: $0) } ?? ReviewNotificationPolicy()
    }

    // Called only by the person's explicit button action, never automatically at launch.
    func enable() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert]) { [weak self] allowed, _ in
            DispatchQueue.main.async {
                self?.enabled = allowed
                UserDefaults.standard.set(allowed, forKey: "gapNotificationsEnabled")
                self?.message = allowed ? "Gap reminders enabled: at most twice a day, two hours apart."
                    : "Notifications are unavailable. Gap questions still appear in the timeline."
            }
        }
    }

    func disable() {
        enabled = false
        UserDefaults.standard.set(false, forKey: "gapNotificationsEnabled")
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["deepfocus-gap-review"])
    }

    func poll(store: TimelineStore, activity: ActivityState) {
        let now = Date()
        guard enabled, store.recordingEnabled, activity.canMonitor, now.timeIntervalSince(lastCheck) >= 30 else { return }
        lastCheck = now
        let range = DateInterval(start: Calendar.current.startOfDay(for: now), end: now)
        guard let gap = store.ledger.reviewCandidates(in: range, now: now).first, policy.permits(gap: gap, now: now) else { return }
        let content = UNMutableNotificationContent()
        content.title = "Help fill a gap in your day"
        // No app names, URLs, location, or activity labels appear on the lock-screen notification.
        content.body = "There’s an interval to review. Open Deep Focus → Today’s timeline when convenient."
        let request = UNNotificationRequest(identifier: "deepfocus-gap-review", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { [weak self] error in
            DispatchQueue.main.async {
                if error != nil { self?.message = "A gap reminder could not be delivered. Review it in the timeline." }
            }
        }
        policy.record(gap: gap, now: now)
        if let data = try? JSONEncoder().encode(policy) { UserDefaults.standard.set(data, forKey: "gapNotificationPolicy") }
    }
}
