import SwiftUI
import CoreLocation
import UniformTypeIdentifiers

struct CompanionView: View {
    @ObservedObject var model: CompanionModel
    @ObservedObject var store: TimelineStore
    @State private var start = Date().addingTimeInterval(-1800)
    @State private var end = Date()
    @State private var category = ActivityCategory.reading
    @State private var exporting = false
    @State private var importing = false
    @State private var document = EvidenceDocument()

    var body: some View {
        NavigationStack {
            Form {
                Section("Record an activity") {
                    DatePicker("From", selection: $start, in: ...Date())
                    DatePicker("Until", selection: $end, in: ...Date())
                    Picker("Activity", selection: $category) {
                        ForEach(ActivityCategory.allCases) { Text($0.title).tag($0) }
                    }
                    Button("Save activity") {
                        store.annotate(start: start, end: end, category: category)
                        if store.errorMessage == nil { model.message = "Activity saved on this phone." }
                    }.disabled(start >= end)
                    Text("Your confirmation records the activity. Location alone does not establish what you did.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Quiet periods") {
                    Button("Quiet for one hour") { store.quiet(for: 3600) }
                    Button("Quiet for the rest of today") {
                        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: Date()))!
                        store.quiet(for: tomorrow.timeIntervalSinceNow)
                    }
                    if let quiet = store.ledger.quietUntil, quiet > Date() {
                        Text("Quiet until \(quiet.formatted())")
                        Button("Resume reviews") { store.resumeReviews() }
                    }
                    Text("Quiet periods travel with your evidence export. This prototype does not send phone notifications.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Optional place visits") {
                    Text("Capture approximate arrivals and departures while the phone is away from your computer. Coarse areas stay on this phone until you export them. No continuous GPS route is recorded.")
                    if !model.visitsEnabled || model.authorization != .authorizedAlways {
                        Button(model.authorization == .authorizedWhenInUse ? "Allow background visits" : "Enable place visits") { model.enableVisits() }
                    }
                    if model.visitsEnabled { Button("Stop place visits", role: .destructive) { model.disableVisits() } }
                    Text("Visits may arrive late or omit an arrival/departure. Test delivery on a physical iPhone.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Recent records") {
                    ForEach(store.ledger.annotations.suffix(10).reversed()) { annotation in
                        VStack(alignment: .leading) {
                            Text(annotation.category.title)
                            Text("\(annotation.start.formatted()) – \(annotation.end.formatted()) · confirmed by you")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    ForEach(store.ledger.evidence.suffix(10).reversed()) { evidence in
                        Text("\(evidence.label) · \(evidence.start.formatted())").font(.caption)
                    }
                }
                Section("Move evidence between devices") {
                    Button("Export tags and place evidence") {
                        do { document = EvidenceDocument(data: try store.exportExchange()); exporting = true }
                        catch { store.errorMessage = "Could not prepare an export." }
                    }
                    Button("Import Deep Focus evidence") { importing = true }
                    Text("Save a JSON export to Files and import it on your Mac. There is no automatic cloud or agent sharing. Exports can contain your activity tags and coarse place information.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if let message = model.message { Section { Text(message) } }
                if let error = store.errorMessage { Section { Text(error).foregroundStyle(.red) } }
            }
            .navigationTitle("Deep Focus")
        }
        .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "DeepFocusEvidence") { result in
            if case .failure = result { store.errorMessage = "The export was not saved." }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                store.importExchange(try Data(contentsOf: url, options: .mappedIfSafe))
            } catch { store.errorMessage = "No evidence file was imported." }
        }
    }
}
