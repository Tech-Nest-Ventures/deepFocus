import SwiftUI

/// One confirmation can describe concurrent activities; Unknown is an exclusive choice.
struct ActivitySelectionView: View {
    @Binding var selection: [ActivityCategory]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Activities — select all that apply").font(.subheadline)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), alignment: .leading)], alignment: .leading) {
                ForEach(ActivityCategory.allCases) { category in
                    Button {
                        if selection.contains(category) {
                            selection.removeAll { $0 == category }
                        } else if category == .unknown {
                            selection = [.unknown]
                        } else {
                            selection.removeAll { $0 == .unknown }
                            selection.append(category)
                            selection = ActivityCategory.allCases.filter { selection.contains($0) }
                        }
                    } label: {
                        Label(category.title, systemImage: selection.contains(category) ? "checkmark.circle.fill" : "circle")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.borderless)
                    .accessibilityAddTraits(selection.contains(category) ? .isSelected : [])
                    .accessibilityValue(selection.contains(category) ? "Selected" : "Not selected")
                }
            }
            Text("Activities can overlap. Walking during a 30-minute call is 30 minutes elapsed, with 30 minutes in each activity.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }
}
