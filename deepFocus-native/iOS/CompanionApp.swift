import SwiftUI

@main
struct CompanionApp: App {
    @StateObject private var model = CompanionModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup { CompanionView(model: model, store: model.store) }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active { model.store.save() }
            }
    }
}
