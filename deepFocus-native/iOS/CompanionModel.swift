import CoreLocation
import Combine

final class CompanionModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    let store = TimelineStore()
    private let location = CLLocationManager()
    @Published private(set) var visitsEnabled = UserDefaults.standard.bool(forKey: "placeVisitsEnabled")
    @Published private(set) var authorization = CLAuthorizationStatus.notDetermined
    @Published var message: String?

    override init() {
        super.init()
        location.delegate = self
        authorization = location.authorizationStatus
        // Recreate the manager for background visit delivery, but never request permission at launch.
        if visitsEnabled && authorization == .authorizedAlways { location.startMonitoringVisits() }
    }

    func enableVisits() {
        visitsEnabled = true
        UserDefaults.standard.set(true, forKey: "placeVisitsEnabled")
        switch location.authorizationStatus {
        case .notDetermined: location.requestWhenInUseAuthorization()
        case .authorizedWhenInUse: location.requestAlwaysAuthorization()
        case .authorizedAlways: location.startMonitoringVisits()
        default: message = "Location access is unavailable. You can still add activity tags manually. Manage permission in iOS Settings."
        }
    }

    func disableVisits() {
        visitsEnabled = false
        UserDefaults.standard.set(false, forKey: "placeVisitsEnabled")
        location.stopMonitoringVisits()
        message = "Place visits stopped. Existing local observations are retained."
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if visitsEnabled && authorization == .authorizedAlways {
            manager.startMonitoringVisits()
            message = "Optional place visits enabled. Delivery times are approximate."
        } else {
            manager.stopMonitoringVisits()
            if authorization == .authorizedWhenInUse {
                message = "Tap Allow background visits to request Always access. Manual tags work without it."
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
        guard visitsEnabled, authorization == .authorizedAlways,
              CLLocationCoordinate2DIsValid(visit.coordinate), visit.horizontalAccuracy.isFinite,
              visit.horizontalAccuracy >= 0 else { return }
        let arrival = visit.arrivalDate
        let departure = visit.departureDate == .distantFuture ? nil : visit.departureDate
        // Unknown arrival is distantPast: retain the event time rather than inventing a long visit.
        let start = arrival == .distantPast ? departure ?? Date() : arrival
        let observation = ContextEvidence(id: UUID(), deviceID: store.ledger.deviceID, source: .phoneVisit,
            start: start, end: departure, recordedAt: Date(), label: departure == nil ? "Place arrival" : "Place departure",
            coarseLatitude: (visit.coordinate.latitude * 100).rounded() / 100,
            coarseLongitude: (visit.coordinate.longitude * 100).rounded() / 100,
            uncertaintyMeters: visit.horizontalAccuracy + 1600)
        // Store a coarse area, never the original coordinate or a claimed purpose.
        store.addEvidence(observation)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        message = "Place updates are unavailable. Manual tags remain available."
    }
}
