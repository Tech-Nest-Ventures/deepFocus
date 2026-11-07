import XCTest
@testable import MonitorCore

final class MonitoringSuspensionTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1000)

    private func report(_ activity: ActivityState) -> BrowserEvent {
        BrowserEvent(browser: .chrome, epoch: activity.epoch, sequence: 1,
                     observedAt: now.timeIntervalSince1970 * 1000, focused: true,
                     privateBrowsing: false, url: "https://example.com/current")
    }

    func testDisplayWakeDoesNotResumeWhileScreenRemainsLocked() {
        var suspension = MonitoringSuspension()
        var activity = ActivityState()
        activity.setForeground(SupportedBrowser.chrome.bundleID)

        XCTAssertTrue(suspension.set(.lock, active: true, activity: &activity))
        suspension.set(.display, active: true, activity: &activity)
        XCTAssertNil(activity.foregroundBundleID)
        XCTAssertFalse(activity.canMonitor)

        XCTAssertFalse(suspension.set(.display, active: false, activity: &activity))
        XCTAssertFalse(activity.canMonitor)
        XCTAssertTrue(suspension.set(.lock, active: false, activity: &activity))
        XCTAssertTrue(activity.canMonitor)
    }

    func testIndependentReasonsCanClearInAnyOrderWithoutEarlyRecovery() {
        for first in MonitoringSuspension.Reason.allCases {
            for last in MonitoringSuspension.Reason.allCases where last != first {
                var suspension = MonitoringSuspension()
                var activity = ActivityState()
                suspension.set(first, active: true, activity: &activity)
                suspension.set(last, active: true, activity: &activity)
                suspension.set(first, active: false, activity: &activity)
                XCTAssertFalse(activity.canMonitor)
                suspension.set(last, active: false, activity: &activity)
                XCTAssertTrue(activity.canMonitor)
            }
        }
    }

    func testDuplicateAndUnmatchedWakeDoNotDiscardCurrentBrowserReport() {
        var suspension = MonitoringSuspension()
        var activity = ActivityState()
        activity.setForeground(SupportedBrowser.chrome.bundleID)
        let current = report(activity)
        XCTAssertTrue(activity.receive(current, now: now))
        XCTAssertFalse(suspension.set(.sleep, active: false, activity: &activity))
        XCTAssertFalse(suspension.set(.sleep, active: false, activity: &activity))
        XCTAssertEqual(activity.url, "https://example.com/current")
        XCTAssertEqual(activity.epoch, current.epoch)

        suspension.set(.sleep, active: true, activity: &activity)
        let suspendedEpoch = activity.epoch
        XCTAssertFalse(suspension.set(.sleep, active: true, activity: &activity))
        XCTAssertEqual(activity.epoch, suspendedEpoch)
    }

    func testRecoveryRejectsReportsFromBeforeAndDuringSuspension() {
        var suspension = MonitoringSuspension()
        var activity = ActivityState()
        activity.setForeground(SupportedBrowser.chrome.bundleID)
        let beforeLock = report(activity)
        XCTAssertTrue(activity.receive(beforeLock, now: now))
        suspension.set(.lock, active: true, activity: &activity)
        XCTAssertNil(activity.url)
        let duringLock = report(activity)
        XCTAssertFalse(activity.receive(duringLock, now: now))
        suspension.set(.lock, active: false, activity: &activity)
        activity.setForeground(SupportedBrowser.chrome.bundleID)
        XCTAssertFalse(activity.receive(beforeLock, now: now))
        XCTAssertFalse(activity.receive(duringLock, now: now))
        XCTAssertNil(activity.url)
        XCTAssertTrue(activity.receive(report(activity), now: now))
    }

    func testWakeCannotUndoUserPauseAndResumeCannotUndoLock() {
        var suspension = MonitoringSuspension()
        var activity = ActivityState()
        activity.setPaused(true)
        suspension.set(.sleep, active: true, activity: &activity)
        suspension.set(.sleep, active: false, activity: &activity)
        XCTAssertTrue(activity.paused)
        XCTAssertFalse(activity.canMonitor)
        suspension.set(.lock, active: true, activity: &activity)
        activity.setPaused(false)
        XCTAssertFalse(activity.canMonitor)
        suspension.set(.lock, active: false, activity: &activity)
        XCTAssertTrue(activity.canMonitor)
        XCTAssertNil(activity.url)
    }
}
