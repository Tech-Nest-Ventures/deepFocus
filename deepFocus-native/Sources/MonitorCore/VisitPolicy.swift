import Foundation

/// Permission and callback eligibility independent of Core Location delivery timing.
struct VisitCapturePolicy {
    enum Authorization { case undetermined, whenInUse, always, unavailable }
    enum Action { case requestWhenInUse, requestAlways, monitor, stop }
    private(set) var generation = UUID()
    private(set) var enabled: Bool
    private var authorization: Authorization = .undetermined

    init(enabled: Bool) { self.enabled = enabled }

    mutating func enable(authorization: Authorization) -> Action {
        enabled = true
        _ = updateAuthorization(authorization)
        switch authorization {
        case .undetermined: return .requestWhenInUse
        case .whenInUse: return .requestAlways
        case .always: return .monitor
        case .unavailable: return .stop
        }
    }

    mutating func updateAuthorization(_ value: Authorization) -> Action {
        if authorization == .always && value != .always { generation = UUID() }
        authorization = value
        return enabled && value == .always ? .monitor : .stop
    }

    mutating func stop() {
        enabled = false
        generation = UUID()
    }

    func accepts(generation: UUID, authorization: Authorization) -> Bool {
        enabled && self.authorization == .always && authorization == .always && self.generation == generation
    }
}

/// Optional place context, not a duration recorder or a claim about activity.
enum VisitPolicy {
    static func observation(arrival: Date?, departure: Date?, latitude: Double, longitude: Double,
                            accuracy: Double, now: Date, deviceID: UUID,
                            existing: [ContextEvidence]) -> ContextEvidence? {
        guard let start = arrival ?? departure,
              now.timeIntervalSince1970.isFinite, start.timeIntervalSince1970.isFinite,
              start <= now, departure.map({ $0.timeIntervalSince1970.isFinite && $0 >= start && $0 <= now }) ?? true,
              latitude.isFinite, longitude.isFinite, (-90...90).contains(latitude), (-180...180).contains(longitude),
              accuracy.isFinite, accuracy >= 0 else { return nil }
        let coarseLatitude = (latitude * 100).rounded() / 100
        let coarseLongitude = (longitude * 100).rounded() / 100
        let prior = existing.first {
            $0.source == .phoneVisit && $0.deviceID == deviceID && $0.start == start
                && $0.coarseLatitude == coarseLatitude && $0.coarseLongitude == coarseLongitude
        }
        // Repeated arrivals and deliveries of an already completed visit add no new evidence.
        if let prior, prior.end != nil || departure == nil { return nil }
        return ContextEvidence(id: prior?.id ?? UUID(), deviceID: deviceID, source: .phoneVisit,
            start: start, end: departure, recordedAt: now,
            label: arrival == nil ? "Place departure · arrival unknown" : departure == nil ? "Place arrival" : "Place visit",
            coarseLatitude: coarseLatitude, coarseLongitude: coarseLongitude, uncertaintyMeters: accuracy + 1600)
    }
}

extension TimelineLedger {
    /// A known departure may complete the same place observation, never another collector's record.
    mutating func recordPlaceVisit(_ observation: ContextEvidence) throws {
        guard observation.source == .phoneVisit,
              observation.isValid, observation.coarseLatitude != nil, observation.coarseLongitude != nil,
              observation.calendar == nil, observation.agent == nil else { throw TimelineError.invalidInterval }
        if let index = evidence.firstIndex(where: { $0.id == observation.id }) {
            let previous = evidence[index]
            guard previous.source == .phoneVisit, previous.deviceID == observation.deviceID,
                  previous.start == observation.start, previous.coarseLatitude == observation.coarseLatitude,
                  previous.coarseLongitude == observation.coarseLongitude else { throw TimelineError.invalidInterval }
            guard previous.end == nil, observation.end != nil, observation.recordedAt >= previous.recordedAt else { return }
            evidence[index] = observation
        } else {
            evidence.append(observation)
        }
    }
}
