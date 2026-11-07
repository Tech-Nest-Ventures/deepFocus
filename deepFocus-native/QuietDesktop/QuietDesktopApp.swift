import SwiftUI
import AppKit

@main struct QuietDesktopExperimentApp: App {
    @StateObject private var model = QuietDesktopModel()
    var body: some Scene {
        Window("Quiet Desktop Experiment", id: "quiet-session") {
            QuietDesktopView(model: model)
                .frame(minWidth: 470, minHeight: 520)
        }.defaultSize(width: 500, height: 560)
    }
}

struct QuietDesktopView: View {
    @ObservedObject var model: QuietDesktopModel
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quiet desktop session").font(.title2.bold())
            Text("Optional camera experiment. Position changes do not establish health, posture quality, attention, or concentration.").foregroundStyle(.secondary)
            Label(model.policy.state.rawValue.capitalized, systemImage: model.policy.state == .stopped ? "video.slash" : "video")
                .font(.headline).accessibilityLabel("Session state: \(model.policy.state.rawValue)")
            Text(model.captureStopping ? "Releasing camera…" : model.message).frame(minHeight: 45, alignment: .leading)
            HStack {
                Button("Start", action: model.start).disabled(model.policy.state != .stopped || model.captureStopping || !model.loggingAvailable || model.trialBlocked)
                Button("Stop") { model.stop() }.disabled(model.policy.state == .stopped)
                Button("Retry calibration", action: model.retryCalibration).disabled(model.policy.state == .stopped)
            }
            HStack {
                Toggle("Quiet — no prompts", isOn: $model.quiet)
                Button("Snooze 15 min", action: model.snooze).disabled(model.policy.state == .stopped)
            }
            Text(model.policy.eligibleFrames == 0 ? "Eligible observations: unavailable / insufficient evidence" : "Eligible observations this session: \(model.policy.eligibleFrames)")
                .font(.caption).foregroundStyle(.secondary)
            Divider()
            Text("Session review").font(.headline)
            Picker("Camera discomfort", selection: $model.discomfort) {
                Text("0 — none").tag(0); Text("1 — slight").tag(1); Text("2 — moderate").tag(2)
                Text("3 — high").tag(3); Text("4 — unacceptable").tag(4)
            }
            Picker("Want to use it again?", selection: $model.continuedUse) {
                ForEach(["Undecided", "Yes", "No"], id: \.self) { Text($0) }
            }
            HStack { Button("Save review", action: model.saveReview); Button("Export trial log…", action: model.exportLog) }
            Text("Frames and landmarks stay transient on this Mac. Only setup, states, prompt feedback and your reviews are saved. No trial or health outcome has been demonstrated.")
                .font(.caption).foregroundStyle(.secondary)
            Spacer(minLength: 0)
        }.padding(24)
    }
}

struct QuietPromptView: View {
    @ObservedObject var model: QuietDesktopModel
    @State private var actualPresence = "unknown"
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your position has differed from your baseline for a while. Adjust if helpful.")
            Picker("Were you here when this appeared?", selection: $actualPresence) {
                Text("Unknown").tag("unknown"); Text("Present").tag("present"); Text("Away").tag("away")
            }
            HStack {
                ForEach(["Useful", "Mistimed", "Not useful"], id: \.self) { rating in
                    Button(rating) { model.feedback(rating.lowercased(), presence: actualPresence) }
                }
            }
            HStack {
                Button("Snooze 15 min") { model.snoozePrompt(presence: actualPresence) }
                Button("Stop") { model.stopPrompt(presence: actualPresence) }
            }
        }.padding(20).frame(width: 420, height: 235)
    }
}
