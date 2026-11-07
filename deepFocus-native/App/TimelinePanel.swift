import SwiftUI
import UniformTypeIdentifiers

struct TimelinePanel: View {
    @ObservedObject var store: TimelineStore
    @ObservedObject var notifications: GapNotificationController
    @State private var importing = false
    @State private var exporting = false
    @State private var document = EvidenceDocument()

    var body: some View {
        ScrollView {
        TimelineView(.periodic(from: .now, by: 30)) { tick in
            let day = DateInterval(start: Calendar.current.startOfDay(for: tick.date), end: tick.date)
            let slices = store.ledger.slices(in: day)
            VStack(alignment: .leading, spacing: 10) {
                Toggle("Save local timeline", isOn: Binding(get: { store.recordingEnabled }, set: store.setRecording))
                Text("Saves app names, website domains, and observed durations on this Mac. Full URLs remain live only. Screen presence and input activity do not prove attention.")
                    .font(.caption).foregroundStyle(.secondary)
                HStack {
                    Button(notifications.enabled ? "Turn off gap reminders" : "Enable gap reminders") {
                        if notifications.enabled { notifications.disable() } else { notifications.enable() }
                    }
                    Button("Quiet today") {
                        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: tick.date))!
                        store.quiet(for: tomorrow.timeIntervalSince(tick.date))
                    }
                }.font(.caption)
                if let message = notifications.message { Text(message).font(.caption).foregroundStyle(.secondary) }
                if let error = store.errorMessage { Text(error).font(.caption).foregroundStyle(.orange) }
                if let quiet = store.ledger.quietUntil, quiet > tick.date {
                    HStack {
                        Text("Gap questions quiet until \(quiet.formatted(date: .omitted, time: .shortened))").font(.caption)
                        Button("Resume") { store.resumeReviews() }
                    }
                } else if let candidate = store.ledger.reviewCandidates(in: day, now: tick.date).first {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Help fill a gap").font(.headline)
                        Text("\(candidate.start.formatted(date: .omitted, time: .shortened))–\(candidate.end.formatted(date: .omitted, time: .shortened)): what happened?")
                            .font(.caption)
                        if let evidence = store.ledger.evidence.last(where: {
                            [.calendar, .phoneVisit].contains($0.source) && $0.start < candidate.end
                                && ($0.end.map { $0 > candidate.start } ?? false)
                        }) {
                            Text("Context: \(evidence.label) (\(evidence.source.rawValue)); activity unconfirmed")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                        HStack {
                            categoryMenu(candidate, title: "Confirm activity")
                            Button("Leave unknown") { annotate(candidate, .unknown) }
                            Button("Quiet 1h") { store.quiet(for: 3600) }
                        }.font(.caption)
                    }.padding(10).background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                }
                HStack {
                    Text("Today").font(.headline)
                    Spacer()
                    let seconds = slices.filter { $0.context?.hasRecentInput == true }.reduce(0) { $0 + $1.duration }
                    Text("\(Int(seconds / 60))m with recent input").font(.caption).foregroundStyle(.secondary)
                }
                    LazyVStack(alignment: .leading, spacing: 10) {
                        ForEach(slices.filter { $0.duration >= 1 }.reversed()) { slice in
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(slice.title).font(.callout).lineLimit(1)
                                    Text("\(slice.start.formatted(date: .omitted, time: .shortened))–\(slice.end.formatted(date: .omitted, time: .shortened)) · \(Int(slice.duration / 60))m · \(basis(slice))")
                                        .font(.caption2).foregroundStyle(.secondary)
                                    if slice.context?.hasRecentInput == false {
                                        Text("No recent input; may be reading or thinking").font(.caption2).foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                categoryMenu(slice, title: "Tag")
                            }
                        }
                    }
                if !store.ledger.evidence.isEmpty {
                    Text("Context evidence").font(.headline)
                    ForEach(store.ledger.evidence.filter { $0.start < day.end && ($0.end ?? $0.start) >= day.start }.suffix(10).reversed()) { evidence in
                        Text("\(evidence.label) · \(evidence.source.rawValue) · \(evidence.start.formatted(date: .omitted, time: .shortened))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                HStack {
                    Button("Import evidence") { importing = true }
                    Button("Export tags / evidence") {
                        do { document = EvidenceDocument(data: try store.exportExchange()); exporting = true }
                        catch { store.errorMessage = "Could not prepare an evidence export." }
                    }
                }.font(.caption)
            }
        }
        }.frame(maxHeight: 420)
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                store.importExchange(try Data(contentsOf: url, options: .mappedIfSafe))
            } catch { store.errorMessage = "No evidence file was imported." }
        }
        .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "DeepFocusEvidence") { result in
            if case .failure = result { store.errorMessage = "The evidence export was not saved." }
        }
    }

    private func annotate(_ slice: TimelineSlice, _ category: ActivityCategory) {
        store.annotate(start: slice.start, end: slice.end, category: category)
    }

    private func categoryMenu(_ slice: TimelineSlice, title: String) -> some View {
        Menu(title) {
            ForEach(ActivityCategory.allCases) { category in
                Button(category.title) { annotate(slice, category) }
            }
        }
    }

    private func basis(_ slice: TimelineSlice) -> String {
        switch slice.basis {
        case .observed: return "observed"
        case .confirmed: return "confirmed by you"
        case .leftUnknown: return "left unknown"
        case .unknown: return "unobserved"
        }
    }
}
