import SwiftUI

@main
@MainActor
struct CompanionApp: App {
    @StateObject private var model = CompanionModel()
    @StateObject private var calendars = CalendarWorkspace()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            CompanionView(model: model, store: model.store, calendars: calendars)
                .task { calendars.attach(to: model.store) }
        }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active { model.store.save() } else { calendars.refresh() }
            }
    }
}
