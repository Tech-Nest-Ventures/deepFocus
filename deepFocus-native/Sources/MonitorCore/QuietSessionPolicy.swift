import Foundation

public enum QuietPresence: String, Codable { case present, away, uncertain, stopped }
public enum QuietObservation { case absent, uncertain, person(x: Double, y: Double, confidence: Double) }
public struct QuietGeometry: Equatable {
    public var camera: String
    public var width: Int
    public var height: Int
    public var mirrored: Bool
    public var orientation: Int
    public var shoulderWidth: Double
    public var midpointX: Double
    public var midpointY: Double
    public init(camera: String, width: Int, height: Int, mirrored: Bool = false, orientation: Int = 1,
                shoulderWidth: Double, midpointX: Double, midpointY: Double) {
        self.camera = camera; self.width = width; self.height = height; self.mirrored = mirrored
        self.orientation = orientation; self.shoulderWidth = shoulderWidth
        self.midpointX = midpointX; self.midpointY = midpointY
    }
}

/// Deterministic experiment policy. Receives transient derived signals, never images or raw landmark arrays.
public struct QuietSessionPolicy {
    public private(set) var state: QuietPresence = .stopped
    public private(set) var generation: UInt64 = 0
    public private(set) var calibrated = false
    public private(set) var calibrationTimedOut = false
    public private(set) var delivered: [Date]
    public private(set) var eligibleFrames = 0
    public private(set) var snoozedUntil: Date?
    public private(set) var quiet = false
    private var lastFrame: Date?
    private var absentSince: Date?
    private var deviationSince: Date?
    private var calibrationStarted: Date?
    private var sampleStarted: Date?
    private var samples: [(Double, Double)] = []
    private var baseline: (Double, Double)?
    private var baselineGeometry: QuietGeometry?

    public init(delivered: [Date] = []) { self.delivered = delivered }
    @discardableResult public mutating func start(at now: Date) -> UInt64 {
        stop(); state = .uncertain; calibrationStarted = now; calibrationTimedOut = false
        return generation
    }
    public mutating func stop() {
        generation &+= 1; state = .stopped; lastFrame = nil; absentSince = nil
        invalidateCalibration(); calibrationStarted = nil; eligibleFrames = 0; snoozedUntil = nil
    }
    public func canDeliverPrompt(at now: Date) -> Bool {
        guard state == .present, calibrated, !quiet,
              snoozedUntil.map({ now >= $0 }) ?? true,
              let lastFrame, now.timeIntervalSince(lastFrame) >= 0, now.timeIntervalSince(lastFrame) <= 2,
              let deviationSince, now.timeIntervalSince(deviationSince) >= 30 else { return false }
        return delivered.filter { now.timeIntervalSince($0) < 3600 }.count < 2
    }
    @discardableResult public mutating func deliverPrompt(at now: Date) -> Bool {
        guard canDeliverPrompt(at: now) else { return false }
        delivered.removeAll { now.timeIntervalSince($0) >= 3600 }; delivered.append(now)
        deviationSince = nil; return true
    }
    public mutating func snooze(at now: Date) { snoozedUntil = now.addingTimeInterval(900); deviationSince = nil }
    public mutating func setQuiet(_ enabled: Bool) { quiet = enabled; deviationSince = nil }
    public mutating func retryCalibration(at now: Date) {
        guard state != .stopped else { return }
        invalidateCalibration(); calibrationStarted = now; calibrationTimedOut = false
    }
    public mutating func tick(at now: Date) {
        guard state != .stopped else { return }
        if let lastFrame, now.timeIntervalSince(lastFrame) > 2 || now < lastFrame {
            state = .uncertain; absentSince = nil; invalidateCalibration()
        }
        if !calibrated, let calibrationStarted, now.timeIntervalSince(calibrationStarted) > 30 { calibrationTimedOut = true }
    }
    public mutating func observe(_ observation: QuietObservation, geometry: QuietGeometry?, at now: Date, generation: UInt64) {
        guard generation == self.generation, state != .stopped else { return }
        if let lastFrame, now <= lastFrame { return }
        if let lastFrame, now.timeIntervalSince(lastFrame) > 2 { absentSince = nil; invalidateCalibration() }
        lastFrame = now
        switch observation {
        case .absent:
            invalidateCalibration()
            if absentSince == nil { absentSince = now }
            state = now.timeIntervalSince(absentSince!) >= 3 ? .away : .uncertain
        case .uncertain:
            state = .uncertain; absentSince = nil; invalidateCalibration()
        case let .person(x, y, confidence):
            guard confidence >= 0.7, x.isFinite, y.isFinite, let geometry,
                  geometry.shoulderWidth >= 0.15 else {
                state = .uncertain; absentSince = nil; invalidateCalibration(); return
            }
            state = .present; absentSince = nil
            if let baselineGeometry, !matches(geometry, baselineGeometry) { invalidateCalibration(); calibrationStarted = now }
            if !calibrated {
                guard !calibrationTimedOut else { return }
                if let calibrationStarted, now.timeIntervalSince(calibrationStarted) > 30 {
                    calibrationTimedOut = true; invalidateCalibration(); return
                }
                if sampleStarted == nil { sampleStarted = now; baselineGeometry = geometry }
                samples.append((x, y))
                if samples.count >= 15, now.timeIntervalSince(sampleStarted!) >= 5 {
                    let mx = median(samples.map { $0.0 }); let my = median(samples.map { $0.1 })
                    if median(samples.map { abs($0.0 - mx) }) <= 0.03,
                       median(samples.map { abs($0.1 - my) }) <= 0.03 {
                        baseline = (mx, my); calibrated = true; samples = []
                    } else { samples = []; sampleStarted = nil }
                }
            }
            if calibrated, let baseline, !quiet, snoozedUntil.map({ now >= $0 }) ?? true {
                eligibleFrames += 1
                if hypot(x - baseline.0, y - baseline.1) > 0.20 {
                    if deviationSince == nil { deviationSince = now }
                } else { deviationSince = nil }
            } else { deviationSince = nil }
        }
    }
    private mutating func invalidateCalibration() {
        calibrated = false; baseline = nil; baselineGeometry = nil; samples = []
        sampleStarted = nil; deviationSince = nil
    }
    private func matches(_ a: QuietGeometry, _ b: QuietGeometry) -> Bool {
        a.camera == b.camera && a.width == b.width && a.height == b.height &&
        a.mirrored == b.mirrored && a.orientation == b.orientation &&
        abs(a.shoulderWidth / b.shoulderWidth - 1) <= 0.2 &&
        hypot(a.midpointX - b.midpointX, a.midpointY - b.midpointY) <= 0.1
    }
    private func median(_ values: [Double]) -> Double { let sorted = values.sorted(); return sorted[sorted.count / 2] }
}
