import SwiftUI

struct ConnectedCalendarsView: View {
    @ObservedObject var workspace: CalendarWorkspace
    @ObservedObject var timeline: TimelineStore
    @ObservedObject var calendars: ConnectedCalendarStore
    @State private var destination = ""
    @State private var preview: [CalendarActualsDraft] = []
    @State private var previewDestination = ""
    @State private var showPreview = false
    @State private var publicationMessage: String?
    @Environment(\.scenePhase) private var scenePhase

    init(workspace: CalendarWorkspace, timeline: TimelineStore) {
        self.workspace = workspace
        self.timeline = timeline
        self.calendars = workspace.calendars
    }

    var body: some View {
        Form {
            Section("Connected calendars") {
                Text(calendars.status).font(.callout)
                HStack {
                    if calendars.isConnected {
                        Button("Refresh") { workspace.refresh() }
                        Button("Disconnect") { calendars.disconnect() }
                    } else {
                        Button("Connect calendars") { Task { await calendars.connect() } }
                    }
                }
                Text("Add your accounts to Apple Calendar on this device. Select calendars below to combine them in one agenda. You can include calendars from multiple accounts.")
                    .font(.caption).foregroundStyle(.secondary)
                Text("Apple requests full calendar access. Deep Focus reads your selected calendars and writes only when you explicitly publish confirmed activities.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            calendarSelection
            Section("Agenda · intentions") {
                DatePicker("Day", selection: $workspace.date, displayedComponents: .date)
                if calendars.agenda.isEmpty {
                    Text(calendars.selectedCalendarIDs.isEmpty ? "Select at least one calendar above." : "No events on this day in your selected calendars.")
                        .foregroundStyle(.secondary)
                }
                ForEach(calendars.agenda, id: \.identity) { event in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(event.title).font(.headline)
                        Text(event.isAllDay ? "All day" : timeRange(event.start, event.end))
                        if let calendar = calendars.calendars.first(where: { $0.id == event.calendarID }) {
                            Label("\(calendars.accountName(for: calendar)) · \(calendar.title)", systemImage: "calendar")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }.padding(.vertical, 3)
                }
                Text("Calendar events describe plans, not proof of what you did. Overlapping events remain separate.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            publishingSection
            Section("Across your devices") {
                Text("Add the same calendar accounts to Apple Calendar on your Mac and iPhone. Your calendar provider syncs events; Deep Focus does not sync its private activity or place records automatically. Those still use the evidence export/import flow.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            if let error = timeline.errorMessage { Text(error).foregroundStyle(.orange) }
        }
        .formStyle(.grouped)
        .navigationTitle("Calendars")
        .task { workspace.attach(to: timeline); workspace.refresh() }
        .onChange(of: workspace.date) { _, _ in workspace.refresh() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { workspace.refresh() } }
        .sheet(isPresented: $showPreview) { publicationPreview }
    }

    private var accounts: [String] { Array(Set(calendars.calendars.map(\.accountID))).sorted() }

    @ViewBuilder private var calendarSelection: some View {
        ForEach(accounts, id: \.self) { accountID in
            let items = calendars.calendars.filter { $0.accountID == accountID }
            Section(items.first.map { calendars.accountName(for: $0) } ?? "Calendar account") {
                TextField("Account label (optional)", text: Binding(
                    get: { calendars.accountAliases[accountID] ?? "" },
                    set: { calendars.setAccountAlias($0, for: accountID) }))
                ForEach(items) { calendar in
                    if calendar.title == ConnectedCalendarPolicy.actualsCalendarTitle {
                        Text("\(calendar.title) · publishing destination").font(.caption)
                    } else {
                        Toggle(isOn: Binding(get: { calendars.selectedCalendarIDs.contains(calendar.id) }, set: { selected in
                            var ids = calendars.selectedCalendarIDs
                            if selected { ids.insert(calendar.id) } else { ids.remove(calendar.id) }
                            calendars.setSelectedCalendarIDs(ids)
                        })) {
                            HStack {
                                Circle().fill(color(calendar.colorHex)).frame(width: 8, height: 8)
                                Text(calendar.title)
                            }
                        }
                    }
                }
            }
        }
    }

    private var drafts: [CalendarActualsDraft] {
        let now = Date()
        let end = min(workspace.day.end, now)
        guard end > workspace.day.start else { return [] }
        return ConnectedCalendarPolicy.actualsDrafts(
            from: timeline.ledger.slices(in: DateInterval(start: workspace.day.start, end: end)),
            deviceID: timeline.ledger.deviceID)
    }

    private var publishingSection: some View {
        Section("Publish confirmed activities") {
            Text("Optionally put this day’s confirmed activity labels and times into a separate calendar. They will appear in Apple Calendar through your selected account. No app names, domains, locations or unknown intervals are published.")
                .font(.caption).foregroundStyle(.secondary)
            Text("Publish from one device for now. Existing published entries are not replaced or deleted when you change an activity; conflicting or overlapping entries require manual review.")
                .font(.caption).foregroundStyle(.secondary)
            if calendars.writableActualsCalendars.isEmpty {
                Text("Create a calendar named Deep Focus — Actuals in Google Calendar (or your calendar provider), enable it in Apple Calendar, then refresh here.")
                    .font(.caption)
            } else {
                Picker("Destination", selection: $destination) {
                    Text("Choose a calendar").tag("")
                    ForEach(calendars.writableActualsCalendars) { calendar in
                        Text("\(calendars.accountName(for: calendar)) · \(calendar.title)").tag(calendar.id)
                    }
                }
                Button("Review \(drafts.count) confirmed entries") {
                    preview = drafts
                    previewDestination = destination
                    publicationMessage = nil
                    showPreview = true
                }.disabled(drafts.isEmpty || destination.isEmpty || !calendars.isConnected)
            }
            if let publicationMessage { Text(publicationMessage).font(.caption) }
        }
    }

    private var publicationPreview: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Publish these entries?").font(.title2)
                Text(workspace.date.formatted(date: .complete, time: .omitted))
                if let calendar = calendars.calendars.first(where: { $0.id == previewDestination }) {
                    Text("\(calendars.accountName(for: calendar)) · \(calendar.title)")
                }
                Text("These labels and times, rounded to seconds, will be saved to your chosen calendar account and may sync to its provider.")
                    .font(.caption)
                List(preview, id: \.marker) { draft in
                    VStack(alignment: .leading) {
                        Text(draft.title)
                        Text(timeRange(draft.start, draft.end)).font(.caption)
                    }
                }
                if let publicationMessage { Text(publicationMessage).foregroundStyle(.orange) }
                HStack {
                    Button("Cancel") { showPreview = false }
                    Spacer()
                    Button("Publish confirmed activities") {
                        do {
                            guard preview == drafts else {
                                publicationMessage = "Activities changed. Close this preview and review them again."
                                return
                            }
                            let count = try calendars.publish(preview, to: previewDestination)
                            publicationMessage = count == 0 ? "Already published." : "Published \(count) confirmed entries."
                            showPreview = false
                        } catch { publicationMessage = error.localizedDescription }
                    }.disabled(!calendars.isConnected)
                }
            }.padding()
            #if os(macOS)
            .frame(width: 540, height: 440)
            #endif
        }
    }

    private func timeRange(_ start: Date, _ end: Date) -> String {
        "\(start.formatted(date: .omitted, time: .standard)) – \(end.formatted(date: .omitted, time: .standard))"
    }

    private func color(_ hex: String) -> Color {
        let value = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0x777777
        return Color(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255,
                     blue: Double(value & 255) / 255)
    }
}
