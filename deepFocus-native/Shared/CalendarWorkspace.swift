import SwiftUI
import Combine

@MainActor
final class CalendarWorkspace: ObservableObject {
    let calendars = ConnectedCalendarStore()
    @Published var date = Date()
    private weak var timeline: TimelineStore?

    var day: DateInterval { Calendar.current.dateInterval(of: .day, for: date)! }

    func attach(to timeline: TimelineStore) {
        guard self.timeline !== timeline else { return }
        self.timeline = timeline
        timeline.clearConnectedCalendarEvidence()
        calendars.onClear = { [weak timeline] in timeline?.clearConnectedCalendarEvidence() }
        calendars.onSnapshot = { [weak timeline] events, range, fetchedAt, selected, excluded in
            timeline?.applyConnectedCalendarSnapshot(events: events, range: range,
                fetchedAt: fetchedAt, selected: selected, excluded: excluded)
        }
        refresh()
    }

    func refresh() { calendars.refresh(in: day) }
}
