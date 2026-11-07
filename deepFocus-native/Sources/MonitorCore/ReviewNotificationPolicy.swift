import Foundation

struct ReviewNotificationPolicy: Codable {
    private(set) var lastSent: Date?
    private(set) var lastGap: String?
    private(set) var sentToday = 0

    func permits(gap: TimelineSlice, now: Date, calendar: Calendar = .current) -> Bool {
        let count = lastSent.map { calendar.isDate($0, inSameDayAs: now) } == true ? sentToday : 0
        let key = "\(gap.start.timeIntervalSince1970):\(gap.end.timeIntervalSince1970)"
        return count < 2 && lastGap != key && (lastSent.map { now.timeIntervalSince($0) >= 7200 } ?? true)
    }

    mutating func record(gap: TimelineSlice, now: Date, calendar: Calendar = .current) {
        if lastSent.map({ calendar.isDate($0, inSameDayAs: now) }) != true { sentToday = 0 }
        sentToday += 1
        lastSent = now
        lastGap = "\(gap.start.timeIntervalSince1970):\(gap.end.timeIntervalSince1970)"
    }
}
