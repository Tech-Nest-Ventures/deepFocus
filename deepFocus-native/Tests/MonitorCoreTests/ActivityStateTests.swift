import XCTest
@testable import MonitorCore

final class ActivityStateTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1000)

    func message(_ state: ActivityState, browser: SupportedBrowser = .chrome, sequence: Int = 1,
                 age: Double = 0, focused: Bool = true, privateBrowsing: Bool = false,
                 url: String? = "https://example.com/work") -> BrowserEvent {
        BrowserEvent(browser: browser, epoch: state.epoch, sequence: sequence,
                     observedAt: (now.timeIntervalSince1970 - age) * 1000,
                     focused: focused, privateBrowsing: privateBrowsing, url: url)
    }

    func testForegroundBrowserOnly() {
        var state = ActivityState()
        state.setForeground(SupportedBrowser.chrome.bundleID)
        XCTAssertFalse(state.receive(message(state, browser: .edge), now: now))
        XCTAssertTrue(state.receive(message(state), now: now))
        XCTAssertEqual(state.url, "https://example.com/work")
        state.setForeground("com.apple.TextEdit")
        XCTAssertNil(state.url)
        XCTAssertFalse(state.receive(message(state), now: now))
    }

    func testSwitchAwayAndBackRejectsOldEpoch() {
        var state = ActivityState()
        state.setForeground(SupportedBrowser.chrome.bundleID)
        let delayed = message(state)
        state.setForeground(SupportedBrowser.edge.bundleID)
        state.setForeground(SupportedBrowser.chrome.bundleID)
        XCTAssertFalse(state.receive(delayed, now: now))
    }

    func testPrivateUnfocusedAndUnavailableReportsClearImmediately() {
        for clear in ["private", "unfocused", "missing", "internal"] {
            var state = ActivityState()
            state.setForeground(SupportedBrowser.chrome.bundleID)
            XCTAssertTrue(state.receive(message(state), now: now))
            let event = message(state, sequence: 2, focused: clear != "unfocused", privateBrowsing: clear == "private",
                                url: clear == "missing" ? nil : clear == "internal" ? "chrome://settings" : "https://private.example")
            XCTAssertTrue(state.receive(event, now: now))
            XCTAssertNil(state.url)
        }
    }

    func testPausedAndSuspendedCannotBeRepopulated() {
        for pause in [true, false] {
            var state = ActivityState()
            state.setForeground(SupportedBrowser.chrome.bundleID)
            state.receive(message(state), now: now)
            let old = message(state, sequence: 2)
            if pause { state.setPaused(true) } else { state.setSuspended(true) }
            XCTAssertNil(state.url)
            XCTAssertFalse(state.receive(message(state), now: now))
            if pause { state.setPaused(false) } else { state.setSuspended(false) }
            XCTAssertFalse(state.receive(old, now: now))
            XCTAssertTrue(state.receive(message(state), now: now))
        }
    }

    func testOutOfOrderAndDuplicateMessagesRejected() {
        var state = ActivityState()
        state.setForeground(SupportedBrowser.chrome.bundleID)
        XCTAssertTrue(state.receive(message(state, sequence: 3), now: now))
        XCTAssertFalse(state.receive(message(state, sequence: 2), now: now))
        XCTAssertFalse(state.receive(message(state, sequence: 3), now: now))
        XCTAssertFalse(state.receive(message(state, sequence: 4, age: 1), now: now))
        XCTAssertEqual(state.url, "https://example.com/work")
    }

    func testStaleFutureAndDisconnectedReports() {
        var state = ActivityState()
        state.setForeground(SupportedBrowser.chrome.bundleID)
        XCTAssertFalse(state.receive(message(state, age: 6), now: now))
        XCTAssertFalse(state.receive(message(state, age: -3), now: now))
        state.receive(message(state), now: now)
        let oldEpoch = state.epoch
        state.expire(now: now.addingTimeInterval(7))
        XCTAssertNil(state.url)
        XCTAssertNotEqual(state.epoch, oldEpoch)
    }

    func testAllSupportedBrowsersAndUnsupportedFallback() {
        for browser in SupportedBrowser.allCases {
            var state = ActivityState()
            state.setForeground(browser.bundleID)
            XCTAssertTrue(state.receive(message(state, browser: browser), now: now))
        }
        XCTAssertNil(SupportedBrowser(bundleID: "org.mozilla.firefox"))
    }

    func testClockMovingBackwardsInvalidatesObservation() {
        var state = ActivityState()
        state.setForeground(SupportedBrowser.chrome.bundleID)
        state.receive(message(state), now: now)
        state.expire(now: now.addingTimeInterval(-60))
        XCTAssertNil(state.url)
    }

    func testUnsafeURLsAndCredentials() {
        for url in ["file:///etc/passwd", "about:blank", "javascript:alert(1)", "https://", "https://example.com/\nsecret", String(repeating: "a", count: 9000)] {
            XCTAssertNil(ActivityState.displayURL(url))
        }
        XCTAssertEqual(ActivityState.displayURL("https://user:password@example.com/path?q=1#section"),
                       "https://example.com/path?q=1#section")
    }
}
