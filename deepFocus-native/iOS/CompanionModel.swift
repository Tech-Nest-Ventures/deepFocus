import CoreLocation
import Combine

final class CompanionModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    let store = TimelineStore()
    private var location = CLLocationManager()
    private var capture = VisitCapturePolicy(enabled: UserDefaults.standard.bool(forKey: "placeVisitsEnabled"))
    private var locationGeneration = UUID()
    @Published private(set) var visitsEnabled = UserDefaults.standard.bool(forKey: "placeVisitsEnabled")
    @Published private(set) var authorization = CLAuthorizationStatus.notDetermined
    @Published var message: String?

    override init() {
        super.init()
        authorization = location.authorizationStatus
        let action = capture.updateAuthorization(Self.permission(authorization))
        locationGeneration = capture.generation
        location.delegate = self
        // Restore explicitly enabled delivery, never request permission at launch.
        apply(action)
    }

    func enableVisits() {
        visitsEnabled = true
        UserDefaults.standard.set(true, forKey: "placeVisitsEnabled")
        authorization = location.authorizationStatus
        let action = capture.enable(authorization: Self.permission(authorization))
        if locationGeneration != capture.generation { replaceLocationManager() }
        apply(action)
    }

    func disableVisits() {
        visitsEnabled = false
        UserDefaults.standard.set(false, forKey: "placeVisitsEnabled")
        capture.stop()
        // A new manager owns the new generation; queued callbacks from the old one cannot be reused.
        replaceLocationManager()
        message = "Place visits stopped. Existing local observations are retained."
    }

    private func replaceLocationManager() {
        location.stopMonitoringVisits()
        location.delegate = nil
        location = CLLocationManager()
        locationGeneration = capture.generation
        location.delegate = self
    }

    private func apply(_ action: VisitCapturePolicy.Action) {
        switch action {
        case .requestWhenInUse: location.requestWhenInUseAuthorization()
        case .requestAlways: location.requestAlwaysAuthorization()
        case .monitor:
            location.startMonitoringVisits()
            message = "Optional place visits enabled. Delivery times are approximate."
        case .stop:
            location.stopMonitoringVisits()
            guard visitsEnabled else { return }
            if authorization == .authorizedWhenInUse {
                message = "Tap Allow background visits to request Always access. Manual tags work without it."
            } else if authorization == .denied || authorization == .restricted {
                message = "Location access is unavailable. You can still add activity tags manually. Manage permission in iOS Settings."
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard manager === location else { return }
        authorization = manager.authorizationStatus
        let action = capture.updateAuthorization(Self.permission(authorization))
        if locationGeneration != capture.generation { replaceLocationManager() }
        apply(action)
    }

    func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
        guard manager === location,
              capture.accepts(generation: locationGeneration, authorization: Self.permission(manager.authorizationStatus)) else { return }
        let arrival = visit.arrivalDate == .distantPast ? nil : visit.arrivalDate
        let departure = visit.departureDate == .distantFuture ? nil : visit.departureDate
        guard let observation = VisitPolicy.observation(arrival: arrival, departure: departure,
            latitude: visit.coordinate.latitude, longitude: visit.coordinate.longitude,
            accuracy: visit.horizontalAccuracy, now: Date(), deviceID: store.ledger.deviceID,
            existing: store.ledger.evidence) else { return }
        // Store a coarse area, never the original coordinate or a claimed purpose.
        store.recordPlaceVisit(observation)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard manager === location, visitsEnabled else { return }
        message = "Place updates are unavailable. Manual tags remain available."
    }

    private static func permission(_ authorization: CLAuthorizationStatus) -> VisitCapturePolicy.Authorization {
        switch authorization {
        case .notDetermined: return .undetermined
        case .authorizedWhenInUse: return .whenInUse
        case .authorizedAlways: return .always
        default: return .unavailable
        }
    }
}
