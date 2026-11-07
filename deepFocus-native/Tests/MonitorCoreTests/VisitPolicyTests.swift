import XCTest
@testable import MonitorCore

final class VisitPolicyTests: XCTestCase {
    let device = UUID()
    let now = Date(timeIntervalSince1970: 2000)

    func testMissingArrivalAndDepartureDoesNotInventAnObservation() {
        XCTAssertNil(VisitPolicy.observation(arrival: nil, departure: nil, latitude: 40.1234,
            longitude: -73.9876, accuracy: 20, now: now, deviceID: device, existing: []))
    }

    func testInvalidOrReversedVisitIsRejectedBeforeStorage() {
        XCTAssertNil(VisitPolicy.observation(arrival: now, departure: now.addingTimeInterval(-10), latitude: 40,
            longitude: -74, accuracy: 20, now: now, deviceID: device, existing: []))
        XCTAssertNil(VisitPolicy.observation(arrival: now.addingTimeInterval(10), departure: nil, latitude: 40,
            longitude: -74, accuracy: 20, now: now, deviceID: device, existing: []))
        for (latitude, longitude, accuracy) in [(91.0, 0.0, 10.0), (0, 181, 10), (0, 0, -1), (.nan, 0, 10), (0, 0, .infinity)] {
            XCTAssertNil(VisitPolicy.observation(arrival: now, departure: nil, latitude: latitude,
                longitude: longitude, accuracy: accuracy, now: now, deviceID: device, existing: []))
        }
    }

    func testPermissionRequestsRequireExplicitTwoStepEnableAndStoppedCallbacksStayRejected() {
        var capture = VisitCapturePolicy(enabled: false)
        XCTAssertEqual(capture.updateAuthorization(.undetermined), .stop)
        XCTAssertEqual(capture.enable(authorization: .undetermined), .requestWhenInUse)
        XCTAssertEqual(capture.updateAuthorization(.whenInUse), .stop)
        XCTAssertEqual(capture.enable(authorization: .whenInUse), .requestAlways)
        XCTAssertEqual(capture.updateAuthorization(.always), .monitor)
        let previous = capture.generation
        XCTAssertTrue(capture.accepts(generation: previous, authorization: .always))
        capture.stop()
        XCTAssertFalse(capture.accepts(generation: previous, authorization: .always))
        XCTAssertEqual(capture.enable(authorization: .always), .monitor)
        XCTAssertFalse(capture.accepts(generation: previous, authorization: .always))
        XCTAssertTrue(capture.accepts(generation: capture.generation, authorization: .always))
        XCTAssertEqual(capture.updateAuthorization(.unavailable), .stop)
        XCTAssertFalse(capture.accepts(generation: capture.generation, authorization: .unavailable))
    }

    func testDepartureCompletesSameCoarseArrivalWithoutDuplicatingOrCreatingHumanTime() throws {
        var ledger = TimelineLedger()
        let arrival = now.addingTimeInterval(-100)
        let first = try XCTUnwrap(VisitPolicy.observation(arrival: arrival, departure: nil, latitude: 40.1234,
            longitude: -73.9876, accuracy: 20, now: now, deviceID: ledger.deviceID, existing: []))
        XCTAssertEqual(first.coarseLatitude, 40.12)
        XCTAssertEqual(first.coarseLongitude, -73.99)
        XCTAssertEqual(first.uncertaintyMeters, 1620)
        try ledger.recordPlaceVisit(first)
        XCTAssertNil(VisitPolicy.observation(arrival: arrival, departure: nil, latitude: 40.1234,
            longitude: -73.9876, accuracy: 20, now: now, deviceID: ledger.deviceID, existing: ledger.evidence))
        let completion = try XCTUnwrap(VisitPolicy.observation(arrival: arrival, departure: now, latitude: 40.1234,
            longitude: -73.9876, accuracy: 20, now: now, deviceID: ledger.deviceID, existing: ledger.evidence))
        XCTAssertEqual(completion.id, first.id)
        try ledger.recordPlaceVisit(completion)
        try ledger.recordPlaceVisit(first)
        XCTAssertEqual(ledger.evidence.count, 1)
        XCTAssertEqual(ledger.evidence.first?.end, now)
        XCTAssertTrue(ledger.intervals.isEmpty)
        XCTAssertTrue(ledger.annotations.isEmpty)
    }

    func testUnknownArrivalIsOnlyADeparturePointAndUnknownDepartureStaysOpen() throws {
        let departure = try XCTUnwrap(VisitPolicy.observation(arrival: nil, departure: now, latitude: 40,
            longitude: -74, accuracy: 20, now: now, deviceID: device, existing: []))
        XCTAssertEqual(departure.start, now)
        XCTAssertEqual(departure.end, now)
        XCTAssertEqual(departure.label, "Place departure · arrival unknown")
        let arrival = try XCTUnwrap(VisitPolicy.observation(arrival: now, departure: nil, latitude: 40,
            longitude: -74, accuracy: 20, now: now, deviceID: device, existing: []))
        XCTAssertNil(arrival.end)
    }

    func testRevokedAndRestoredPermissionCannotAcceptPriorGeneration() {
        var capture = VisitCapturePolicy(enabled: true)
        XCTAssertEqual(capture.updateAuthorization(.always), .monitor)
        let oldGeneration = capture.generation
        // Fresh manager authorization protects even before the delegate updates the policy.
        XCTAssertFalse(capture.accepts(generation: oldGeneration, authorization: .unavailable))
        XCTAssertEqual(capture.updateAuthorization(.unavailable), .stop)
        XCTAssertEqual(capture.updateAuthorization(.always), .monitor)
        XCTAssertFalse(capture.accepts(generation: oldGeneration, authorization: .always))
        XCTAssertTrue(capture.accepts(generation: capture.generation, authorization: .always))
        var disabled = VisitCapturePolicy(enabled: false)
        XCTAssertEqual(disabled.updateAuthorization(.always), .stop)
    }

    func testExchangeCompletesPreviouslyImportedArrivalWithoutLosingDeviceIdentity() throws {
        var desktop = TimelineLedger()
        let first = try XCTUnwrap(VisitPolicy.observation(arrival: now.addingTimeInterval(-100), departure: nil,
            latitude: 40, longitude: -74, accuracy: 20, now: now, deviceID: device, existing: []))
        let arrivalFile = TimelineExchange(annotations: [], evidence: [first])
        try arrivalFile.merge(into: &desktop)
        let completed = try XCTUnwrap(VisitPolicy.observation(arrival: first.start, departure: now,
            latitude: 40, longitude: -74, accuracy: 20, now: now, deviceID: device, existing: [first]))
        let completedFile = TimelineExchange(annotations: [], evidence: [completed])
        try completedFile.merge(into: &desktop)
        try arrivalFile.merge(into: &desktop)
        XCTAssertEqual(desktop.evidence.count, 1)
        XCTAssertEqual(desktop.evidence.first?.end, now)
        XCTAssertEqual(desktop.evidence.first?.deviceID, device)
        XCTAssertTrue(desktop.intervals.isEmpty)
    }
}
