import XCTest
@testable import MonitorCore

final class QuietSessionPolicyTests: XCTestCase {
    func testStopRejectsDelayedFramesAndRequiresExplicitStart() {
        var policy = QuietSessionPolicy()
        let generation = policy.start(at: Date(timeIntervalSince1970: 0))
        policy.stop()
        policy.observe(.absent, geometry: nil, at: Date(timeIntervalSince1970: 4), generation: generation)
        XCTAssertEqual(policy.state, .stopped)
        XCTAssertFalse(policy.calibrated)
        XCTAssertFalse(policy.canDeliverPrompt(at: Date(timeIntervalSince1970: 40)))
    }
    func testOnlyUsableContinuousAbsenceBecomesAway() {
        var policy = QuietSessionPolicy()
        let generation = policy.start(at: time(0))
        for second in 0...3 { policy.observe(.absent, geometry: nil, at: time(Double(second)), generation: generation) }
        XCTAssertEqual(policy.state, .away)
        policy.observe(.uncertain, geometry: nil, at: time(4), generation: generation)
        XCTAssertEqual(policy.state, .uncertain)
        policy.observe(.absent, geometry: nil, at: time(5), generation: generation)
        XCTAssertEqual(policy.state, .uncertain)
    }
    private func time(_ seconds: Double) -> Date { Date(timeIntervalSince1970: seconds) }
    private var geometry: QuietGeometry { QuietGeometry(camera: "synthetic", width: 640, height: 480, shoulderWidth: 0.4, midpointX: 0.5, midpointY: 0.5) }
    func testCalibrationNeedsStableFiveSecondsAndInvalidatesOnUncertainty() {
        var policy = QuietSessionPolicy()
        let generation = policy.start(at: time(0))
        for index in 0..<15 {
            policy.observe(.person(x: 0, y: 0.5, confidence: 0.9), geometry: geometry, at: time(Double(index) / 3), generation: generation)
        }
        XCTAssertFalse(policy.calibrated)
        policy.observe(.person(x: 0, y: 0.5, confidence: 0.9), geometry: geometry, at: time(5), generation: generation)
        XCTAssertTrue(policy.calibrated)
        policy.observe(.uncertain, geometry: nil, at: time(6), generation: generation)
        XCTAssertFalse(policy.calibrated)
        XCTAssertEqual(policy.state, .uncertain)
    }
    func testPromptRequiresThirtyFreshSecondsAndRechecksDelivery() {
        var policy = QuietSessionPolicy()
        let generation = policy.start(at: time(0))
        for index in 0...15 { policy.observe(.person(x: 0, y: 0.5, confidence: 0.9), geometry: geometry, at: time(Double(index) / 3), generation: generation) }
        for second in 6..<36 { policy.observe(.person(x: 0.3, y: 0.5, confidence: 0.9), geometry: geometry, at: time(Double(second)), generation: generation) }
        XCTAssertFalse(policy.canDeliverPrompt(at: time(35)))
        policy.observe(.person(x: 0.3, y: 0.5, confidence: 0.9), geometry: geometry, at: time(36), generation: generation)
        XCTAssertTrue(policy.canDeliverPrompt(at: time(36)))
        XCTAssertFalse(policy.canDeliverPrompt(at: time(39)))
        policy.stop()
        XCTAssertFalse(policy.canDeliverPrompt(at: time(36)))
    }
    func testGeometryChangeAndStaleFramesInvalidateCalibration() {
        var policy = calibratedPolicy()
        var moved = geometry; moved.midpointX = 0.7
        policy.observe(.person(x: 0, y: 0.5, confidence: 0.9), geometry: moved, at: time(6), generation: policy.generation)
        XCTAssertFalse(policy.calibrated)
        policy = calibratedPolicy()
        policy.tick(at: time(8))
        XCTAssertEqual(policy.state, .uncertain)
        XCTAssertFalse(policy.calibrated)
    }
    func testLowConfidenceAndUnstableCalibrationNeverBecomeEligible() {
        var policy = QuietSessionPolicy()
        let generation = policy.start(at: time(0))
        policy.observe(.person(x: 0, y: 0.5, confidence: 0.69), geometry: geometry, at: time(0), generation: generation)
        XCTAssertEqual(policy.state, .uncertain)
        for index in 1...90 {
            policy.observe(.person(x: Double(index % 3) / 3, y: 0.5, confidence: 0.9), geometry: geometry, at: time(Double(index) / 3), generation: generation)
        }
        policy.tick(at: time(31))
        XCTAssertFalse(policy.calibrated)
        XCTAssertTrue(policy.calibrationTimedOut)
        XCTAssertEqual(policy.eligibleFrames, 0)
    }
    func testRateCapSurvivesRestartAndSnoozeQuietResetSustainedDuration() {
        var policy = calibratedPolicy()
        feedDeviation(&policy, from: 6, through: 36)
        XCTAssertTrue(policy.deliverPrompt(at: time(36)))
        feedDeviation(&policy, from: 37, through: 67)
        XCTAssertTrue(policy.deliverPrompt(at: time(67)))
        feedDeviation(&policy, from: 68, through: 100)
        XCTAssertFalse(policy.canDeliverPrompt(at: time(100)))
        var restarted = QuietSessionPolicy(delivered: policy.delivered)
        _ = restarted.start(at: time(100)); XCTAssertEqual(restarted.delivered.count, 2)
        policy = calibratedPolicy()
        feedDeviation(&policy, from: 6, through: 35)
        policy.snooze(at: time(35))
        feedDeviation(&policy, from: 36, through: 935)
        XCTAssertFalse(policy.canDeliverPrompt(at: time(935)))
        feedDeviation(&policy, from: 936, through: 965)
        XCTAssertTrue(policy.canDeliverPrompt(at: time(965)))
        policy.setQuiet(true); XCTAssertFalse(policy.canDeliverPrompt(at: time(965)))
        policy.setQuiet(false); XCTAssertFalse(policy.canDeliverPrompt(at: time(965)))
    }
    func testStopWorksFromEveryStateAndOldSessionCannotRestoreNewSession() {
        for observation in [QuietObservation.absent, .uncertain, .person(x: 0, y: 0.5, confidence: 0.9)] {
            var policy = calibratedPolicy()
            let oldGeneration = policy.generation
            for second in 6...9 { policy.observe(observation, geometry: geometry, at: time(Double(second)), generation: oldGeneration) }
            policy.snooze(at: time(9)); policy.stop(); policy.stop()
            XCTAssertEqual(policy.state, .stopped); XCTAssertFalse(policy.calibrated)
            let newGeneration = policy.start(at: time(10))
            policy.observe(.person(x: 0, y: 0.5, confidence: 0.9), geometry: geometry, at: time(11), generation: oldGeneration)
            XCTAssertEqual(policy.state, .uncertain)
            XCTAssertNotEqual(newGeneration, oldGeneration)
        }
    }
    private func calibratedPolicy() -> QuietSessionPolicy {
        var policy = QuietSessionPolicy()
        let generation = policy.start(at: time(0))
        for index in 0...15 { policy.observe(.person(x: 0, y: 0.5, confidence: 0.9), geometry: geometry, at: time(Double(index) / 3), generation: generation) }
        return policy
    }
    private func feedDeviation(_ policy: inout QuietSessionPolicy, from start: Int, through end: Int) {
        for second in start...end { policy.observe(.person(x: 0.3, y: 0.5, confidence: 0.9), geometry: geometry, at: time(Double(second)), generation: policy.generation) }
    }
    func testRollingHourLimitExpiresExactlyAtBoundary() {
        var policy = QuietSessionPolicy(delivered: [time(-3564), time(-3533)])
        let generation = policy.start(at: time(0))
        for index in 0...15 { policy.observe(.person(x: 0, y: 0.5, confidence: 0.9), geometry: geometry, at: time(Double(index) / 3), generation: generation) }
        feedDeviation(&policy, from: 6, through: 35)
        XCTAssertFalse(policy.canDeliverPrompt(at: time(35)))
        feedDeviation(&policy, from: 36, through: 36)
        XCTAssertTrue(policy.deliverPrompt(at: time(36)))
        XCTAssertEqual(policy.delivered, [time(-3533), time(36)])
    }
}
