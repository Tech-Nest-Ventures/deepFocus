import SwiftUI

@main
@MainActor
struct DeepFocusApp: App {
    @StateObject private var model = MonitorModel()
    @StateObject private var calendars = CalendarWorkspace()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        Window("Deep Focus", id: "monitor") {
            MonitorView(model: model, showSetup: true)
                .task { calendars.attach(to: model.timeline) }
        }
        .windowResizability(.contentSize)

        Window("Calendars", id: "calendars") {
            ConnectedCalendarsView(workspace: calendars, timeline: model.timeline)
                .frame(minWidth: 600, minHeight: 560)
        }
        .defaultSize(width: 680, height: 720)

        MenuBarExtra("Deep Focus", systemImage: model.activity.paused ? "pause.circle" : "scope") {
            MonitorView(model: model)
                .task { calendars.attach(to: model.timeline) }
        }
        .menuBarExtraStyle(.window)
        .onChange(of: scenePhase) { _, phase in if phase == .active { calendars.refresh() } }
    }
}

struct MonitorView: View {
    @ObservedObject var model: MonitorModel
    @Environment(\.openWindow) private var openWindow
    @State private var showSetup = false
    @State private var showTimeline = false

    init(model: MonitorModel, showSetup: Bool = false) {
        self.model = model
        _showSetup = State(initialValue: showSetup)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Deep Focus").font(.headline)
                Spacer()
                Button("Open window") { openWindow(id: "monitor") }
                    .font(.caption)
                Circle().fill(model.activity.canMonitor ? Color.green : Color.secondary).frame(width: 7, height: 7)
            }
            Text(model.statusText).font(.caption).foregroundStyle(.secondary)
            HStack(spacing: 10) {
                if let icon = model.appIcon {
                    Image(nsImage: icon).resizable().frame(width: 32, height: 32)
                } else { Image(systemName: "macwindow").font(.title2).frame(width: 32) }
                Text(model.appName).font(.title3.weight(.medium)).lineLimit(2)
            }
            if let url = model.activity.url {
                Text(url).font(.system(.callout, design: .monospaced)).textSelection(.enabled)
                    .lineLimit(5).frame(maxWidth: .infinity, alignment: .leading)
            } else if model.activity.browser != nil && model.activity.canMonitor {
                Text("URL unavailable. Enable and pair the extension; private tabs are excluded.")
                    .font(.callout).foregroundStyle(.secondary)
            }
            if let error = model.bridgeError { Text(error).font(.caption).foregroundStyle(.orange) }
            Divider()
            Button(showTimeline ? "Hide timeline" : "Today’s timeline") {
                showTimeline.toggle()
                if showTimeline { showSetup = false }
            }
            Button("Calendars") { openWindow(id: "calendars") }
            if showTimeline { TimelinePanel(store: model.timeline, notifications: model.gapNotifications) }
            HStack {
                Button(model.activity.paused ? "Resume" : "Pause", action: model.togglePause)
                Button("Browser setup") {
                    showSetup.toggle()
                    if showSetup { showTimeline = false }
                }
                Spacer()
                Button("Quit") { NSApplication.shared.terminate(nil) }
            }
            if showSetup {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Connect your browser").font(.headline)
                    Text("1. Enable Deep Focus Browser Monitor in your browser.\n2. Copy the pairing code below.\n3. Open the extension, select this browser, paste the code, and choose Pair.\n4. In Safari, also choose Allow Safari URL access.")
                    HStack {
                        Button("Copy pairing code", action: model.copyPairingCode)
                        Button("Safari settings", action: model.openSafariSettings)
                    }
                    Text("Chrome / Edge / Dia / Arc: load Browser/chromium as an unpacked extension. See the project README for setup.")
                        .foregroundStyle(.secondary)
                    if let message = model.setupMessage { Text(message).foregroundStyle(.secondary) }
                    Text("Full URLs are live only. Optional local timeline saves app names and domains. Calendar publishing shares only the confirmed labels and times you explicitly choose.").foregroundStyle(.secondary)
                }.font(.caption)
            }
        }
        .padding(20)
        .frame(width: 380)
    }
}
