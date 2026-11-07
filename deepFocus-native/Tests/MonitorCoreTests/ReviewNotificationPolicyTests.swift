import XCTest
@testable import MonitorCore

final class ReviewNotificationPolicyTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    func gap(_ offset: Double) -> TimelineSlice {
        TimelineSlice(start: now.addingTimeInterval(offset), end: now.addingTimeInterval(offset + 1000),
                      context: nil, category: nil, basis: .unknown)
    }

    func testReminderRateLimitAndDuplicateSuppression() {
        var policy = ReviewNotificationPolicy()
        XCTAssertTrue(policy.permits(gap: gap(-2000), now: now))
        policy.record(gap: gap(-2000), now: now)
        XCTAssertFalse(policy.permits(gap: gap(-2000), now: now.addingTimeInterval(8000)))
        XCTAssertFalse(policy.permits(gap: gap(-1000), now: now.addingTimeInterval(100)))
        XCTAssertTrue(policy.permits(gap: gap(-1000), now: now.addingTimeInterval(8000)))
        policy.record(gap: gap(-1000), now: now.addingTimeInterval(8000))
        XCTAssertFalse(policy.permits(gap: gap(1000), now: now.addingTimeInterval(16000)))
    }

    func testNextDayResetsCountButClockReversalDoesNotPrompt() {
        var policy = ReviewNotificationPolicy()
        policy.record(gap: gap(-2000), now: now)
        XCTAssertFalse(policy.permits(gap: gap(-1000), now: now.addingTimeInterval(-1)))
        XCTAssertTrue(policy.permits(gap: gap(-1000), now: now.addingTimeInterval(86400)))
    }
}
