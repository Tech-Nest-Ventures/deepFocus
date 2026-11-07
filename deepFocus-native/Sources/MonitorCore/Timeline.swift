import Foundation

enum ActivityCategory: String, Codable, CaseIterable, Identifiable {
    case planning, execution, delegation, review, communication
    case reading, walking, workout, family, prayer, recovery, leisure, travel, other, unknown
    var id: String { rawValue }
    var title: String { rawValue == "review" ? "Review / approval" : rawValue.capitalized }
}

struct DesktopContext: Codable, Equatable {
    let bundleID: String
    let appName: String
    let websiteHost: String?
    let hasRecentInput: Bool

    init(bundleID: String, appName: String, url: String?, hasRecentInput: Bool) {
        self.bundleID = bundleID
        self.appName = appName
        websiteHost = url.flatMap(ActivityState.displayURL).flatMap { URLComponents(string: $0)?.host?.lowercased() }
        self.hasRecentInput = hasRecentInput
    }
}

struct ActivityInterval: Codable, Identifiable {
    let id: UUID
    let deviceID: UUID
    let start: Date
    var end: Date
    let context: DesktopContext
}

struct ActivityAnnotation: Codable, Identifiable {
    let id: UUID
    let deviceID: UUID
    let start: Date
    let end: Date
    let category: ActivityCategory
    let recordedAt: Date
}

/// Optional collectors contribute context, never a confirmed purpose or brain-state score.
struct ContextEvidence: Codable, Identifiable {
    enum Source: String, Codable { case calendar, phoneVisit, agentTask, camera, eeg }
    let id: UUID
    let deviceID: UUID
    let source: Source
    let start: Date
    let end: Date?
    let recordedAt: Date
    let label: String
    let coarseLatitude: Double?
    let coarseLongitude: Double?
    let uncertaintyMeters: Double?
}

struct TimelineSlice: Identifiable {
    enum Basis: String { case observed, confirmed, leftUnknown, unknown }
    var id: Date { start }
    let start: Date
    let end: Date
    let context: DesktopContext?
    let category: ActivityCategory?
    let basis: Basis
    var duration: TimeInterval { end.timeIntervalSince(start) }
    var title: String { category?.title ?? context?.websiteHost ?? context?.appName ?? "Unknown" }
}

enum TimelineError: Error { case invalidArchive, invalidInterval, incompatibleVersion }

struct TimelineLedger: Codable {
    var schemaVersion = 1
    var deviceID = UUID()
    var startedAt: Date
    var intervals: [ActivityInterval] = []
    var annotations: [ActivityAnnotation] = []
    var evidence: [ContextEvidence] = []
    var quietUntil: Date?

    init(startedAt: Date = Date()) { self.startedAt = startedAt }

    mutating func append(start: Date, end: Date, context: DesktopContext) {
        guard end > start else { return }
        if let last = intervals.last, last.deviceID == deviceID, last.context == context,
           abs(last.end.timeIntervalSince(start)) < 0.001 {
            intervals[intervals.count - 1].end = end
        } else {
            intervals.append(ActivityInterval(id: UUID(), deviceID: deviceID, start: start, end: end, context: context))
        }
    }

    mutating func annotate(start: Date, end: Date, category: ActivityCategory, now: Date) throws {
        guard start < end, end <= now, start.timeIntervalSince1970.isFinite else { throw TimelineError.invalidInterval }
        annotations.append(ActivityAnnotation(id: UUID(), deviceID: deviceID, start: start, end: end,
                                               category: category, recordedAt: now))
    }

    /// Partition time once. Last explicit correction wins; the observed record is preserved.
    func slices(in range: DateInterval) -> [TimelineSlice] {
        guard range.duration > 0 else { return [] }
        let relevant = intervals.filter { $0.start < range.end && $0.end > range.start }
        let corrections = annotations.filter { $0.start < range.end && $0.end > range.start }
        var boundaries = Set([range.start, range.end])
        for interval in relevant { boundaries.insert(max(range.start, interval.start)); boundaries.insert(min(range.end, interval.end)) }
        for annotation in corrections { boundaries.insert(max(range.start, annotation.start)); boundaries.insert(min(range.end, annotation.end)) }
        let sorted = boundaries.sorted()
        return zip(sorted, sorted.dropFirst()).map { start, end in
            let observed = relevant.last { $0.start <= start && $0.end >= end }
            let correction = corrections.last { $0.start <= start && $0.end >= end }
            let basis: TimelineSlice.Basis = correction.map { $0.category == .unknown ? .leftUnknown : .confirmed }
                ?? (observed == nil ? .unknown : .observed)
            return TimelineSlice(start: start, end: end, context: observed?.context,
                                 category: correction?.category, basis: basis)
        }
    }

    func reviewCandidates(in range: DateInterval, now: Date) -> [TimelineSlice] {
        guard quietUntil.map({ $0 <= now }) ?? true else { return [] }
        let start = max(startedAt, range.start)
        let end = min(now, range.end)
        guard end > start else { return [] }
        // Only completed gaps: the person must have returned to an observation after the gap.
        let latestObservedEnd = intervals.map(\.end).max() ?? start
        return slices(in: DateInterval(start: start, end: end)).filter {
            ($0.basis == .unknown || ($0.basis == .observed && $0.context?.hasRecentInput == false))
                && $0.duration >= 15 * 60 && $0.end < latestObservedEnd
        }.reversed()
    }

    /// Calendar/place/agent evidence never becomes human time by insertion.
    mutating func addEvidence(_ observation: ContextEvidence) throws {
        guard observation.start.timeIntervalSince1970.isFinite,
              observation.end.map({ $0 >= observation.start }) ?? true,
              observation.label.count <= 120 else { throw TimelineError.invalidInterval }
        guard !evidence.contains(where: { $0.id == observation.id }) else { return }
        evidence.append(observation)
    }

    func validate() throws {
        guard schemaVersion == 1 else { throw TimelineError.incompatibleVersion }
        guard Set(intervals.map(\.id)).count == intervals.count,
              Set(annotations.map(\.id)).count == annotations.count,
              Set(evidence.map(\.id)).count == evidence.count,
              intervals.allSatisfy({ $0.start < $0.end && $0.context.bundleID.count <= 255
            && $0.context.appName.count <= 255
            && ($0.context.websiteHost.map({ !$0.contains("/") && !$0.contains("@") && $0.count <= 255 }) ?? true) }),
              annotations.allSatisfy({ $0.start < $0.end }),
              evidence.allSatisfy({ observation in
                  (observation.end.map { $0 >= observation.start } ?? true) && observation.label.count <= 120
                  && (observation.coarseLatitude.map { $0.isFinite && (-90...90).contains($0) } ?? true)
                  && (observation.coarseLongitude.map { $0.isFinite && (-180...180).contains($0) } ?? true)
                  && (observation.uncertaintyMeters.map { $0.isFinite && $0 >= 0 } ?? true)
              }) else { throw TimelineError.invalidArchive }
    }
}

/// User-mediated file exchange. Desktop observations stay device-local; evidence does not imply attention.
struct TimelineExchange: Codable {
    var schemaVersion = 1
    let annotations: [ActivityAnnotation]
    let evidence: [ContextEvidence]
    var quietUntil: Date? = nil

    func encode() throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(self)
    }

    static func decode(_ data: Data) throws -> TimelineExchange {
        guard data.count <= 5_000_000 else { throw TimelineError.invalidArchive }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        let exchange = try decoder.decode(Self.self, from: data)
        guard exchange.schemaVersion == 1 else { throw TimelineError.incompatibleVersion }
        var validation = TimelineLedger()
        validation.annotations = exchange.annotations
        validation.evidence = exchange.evidence
        try validation.validate()
        return exchange
    }

    func merge(into ledger: inout TimelineLedger) {
        let knownAnnotations = Set(ledger.annotations.map(\.id))
        let knownEvidence = Set(ledger.evidence.map(\.id))
        ledger.annotations.append(contentsOf: annotations.filter { !knownAnnotations.contains($0.id) })
        ledger.evidence.append(contentsOf: evidence.filter { !knownEvidence.contains($0.id) })
        ledger.annotations.sort {
            $0.recordedAt == $1.recordedAt ? $0.id.uuidString < $1.id.uuidString : $0.recordedAt < $1.recordedAt
        }
        if let earliest = ledger.annotations.map(\.start).min() { ledger.startedAt = min(ledger.startedAt, earliest) }
        if let quietUntil { ledger.quietUntil = max(ledger.quietUntil ?? .distantPast, quietUntil) }
    }
}

/// Counts only covered sampling intervals. Suspended processes and clock jumps create gaps.
struct DurationRecorder {
    private var previous: (context: DesktopContext?, wall: Date, uptime: TimeInterval)?

    mutating func sample(_ context: DesktopContext?, wall: Date, uptime: TimeInterval, into ledger: inout TimelineLedger) {
        defer { previous = (context, wall, uptime) }
        guard let previous, let priorContext = previous.context else { return }
        let elapsed = uptime - previous.uptime
        let wallElapsed = wall.timeIntervalSince(previous.wall)
        guard elapsed > 0, elapsed <= 5, wallElapsed > 0, abs(elapsed - wallElapsed) <= 1 else { return }
        ledger.append(start: previous.wall, end: wall, context: priorContext)
    }

    mutating func reset() { previous = nil }
}

enum TimelineArchive {
    static func encode(_ ledger: TimelineLedger) throws -> Data {
        try ledger.validate()
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(ledger)
    }

    static func decode(_ data: Data) throws -> TimelineLedger {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        let ledger = try decoder.decode(TimelineLedger.self, from: data)
        try ledger.validate()
        return ledger
    }
}
