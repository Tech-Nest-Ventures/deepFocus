import Foundation
import Network

/// A bounded HTTP server on IPv4 loopback only. Handlers run on the main queue.
final class BridgeServer {
    private var listener: NWListener?
    private var clients: [UUID: NWConnection] = [:]
    private let token: String
    var status: () -> [String: Any] = { [:] }
    var event: (BrowserEvent) -> Bool = { _ in false }
    var stateChanged: (String?) -> Void = { _ in }

    init(token: String) { self.token = token }

    func start() throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 17322)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        listener.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready: self?.stateChanged(nil)
            case .failed: self?.stateChanged("Browser bridge unavailable. Quit other native copies, then relaunch.")
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
        listener.start(queue: .main)
    }

    private func accept(_ connection: NWConnection) {
        guard clients.count < 16 else { connection.cancel(); return }
        let id = UUID()
        clients[id] = connection
        connection.start(queue: .main)
        // Bound both memory and the lifetime of incomplete requests.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in self?.close(id) }
        read(id, buffer: Data())
    }

    private func read(_ id: UUID, buffer: Data) {
        guard let connection = clients[id] else { return }
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, done, error in
            guard let self, self.clients[id] != nil else { return }
            var bytes = buffer
            if let data { bytes.append(data) }
            do {
                if let request = try BridgeRequest.parse(bytes) {
                    self.respond(id, request: request)
                } else if done || error != nil {
                    self.close(id)
                } else { self.read(id, buffer: bytes) }
            } catch {
                self.send(id, code: error is RequestError && bytes.count > BridgeRequest.maximumSize ? 413 : 400)
            }
        }
    }

    private func respond(_ id: UUID, request: BridgeRequest) {
        if request.method == "OPTIONS" {
            guard request.allowedOrigin != nil,
                  ["/v1/status", "/v1/event"].contains(request.path) else { send(id, code: 403); return }
            send(id, code: 204, origin: request.allowedOrigin)
            return
        }
        guard request.authenticated(with: token) else { send(id, code: 401); return }
        if request.path == "/v1/status", request.method == "GET", request.body.isEmpty {
            send(id, code: 200, json: status(), origin: request.allowedOrigin)
        } else if request.path == "/v1/event", request.method == "POST" {
            guard request.headers["content-type"]?.lowercased().split(separator: ";").first == "application/json",
                  let payload = try? JSONDecoder().decode(BrowserEvent.self, from: request.body) else {
                send(id, code: 400, origin: request.allowedOrigin); return
            }
            send(id, code: event(payload) ? 200 : 409, origin: request.allowedOrigin)
        } else { send(id, code: 404, origin: request.allowedOrigin) }
    }

    private func send(_ id: UUID, code: Int, json: [String: Any] = [:], origin: String? = nil) {
        guard let connection = clients[id] else { return }
        let body = code == 204 ? Data() : (try? JSONSerialization.data(withJSONObject: json)) ?? Data()
        var headers = "HTTP/1.1 \(code) Response\r\nContent-Type: application/json\r\nContent-Length: \(body.count)\r\nConnection: close\r\nCache-Control: no-store\r\n"
        if let origin {
            headers += "Access-Control-Allow-Origin: \(origin)\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Authorization, Content-Type\r\n"
        }
        connection.send(content: Data((headers + "\r\n").utf8) + body, completion: .contentProcessed { [weak self] _ in
            self?.close(id)
        })
    }

    private func close(_ id: UUID) { clients.removeValue(forKey: id)?.cancel() }
}
