import Foundation

enum RequestError: Error { case invalid, tooLarge }

struct BridgeRequest {
    static let maximumSize = 24_576
    let method: String
    let path: String
    let headers: [String: String]
    let body: Data

    /// nil means more bytes are needed. No chunked requests, pipelining, or ambiguous headers.
    static func parse(_ data: Data) throws -> BridgeRequest? {
        guard data.count <= maximumSize else { throw RequestError.tooLarge }
        guard let separator = data.range(of: Data("\r\n\r\n".utf8)) else {
            if data.count > 8192 { throw RequestError.tooLarge }
            return nil
        }
        guard separator.lowerBound <= 8192,
              let text = String(data: data[..<separator.lowerBound], encoding: .utf8) else {
            throw RequestError.invalid
        }
        let lines = text.components(separatedBy: "\r\n")
        let first = lines[0].split(separator: " ")
        guard first.count == 3, first[2] == "HTTP/1.1" else { throw RequestError.invalid }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { throw RequestError.invalid }
            let key = String(line[..<colon]).lowercased()
            guard !key.isEmpty, key.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }),
                  headers[key] == nil else { throw RequestError.invalid }
            headers[key] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        }
        guard headers["host"] == "127.0.0.1:17322", headers["transfer-encoding"] == nil else {
            throw RequestError.invalid
        }
        let length: Int
        if let value = headers["content-length"] {
            guard !value.isEmpty, value.allSatisfy({ $0.isASCII && $0.isNumber }),
                  let parsed = Int(value), parsed <= 16_384 else { throw RequestError.tooLarge }
            length = parsed
        } else { length = 0 }
        let available = data.count - separator.upperBound
        guard available <= length else { throw RequestError.invalid }
        guard available == length else { return nil }
        return BridgeRequest(method: String(first[0]), path: String(first[1]), headers: headers,
                             body: Data(data[separator.upperBound...]))
    }

    var allowedOrigin: String? {
        guard let origin = headers["origin"],
              let parts = URLComponents(string: origin),
              ["chrome-extension", "safari-web-extension"].contains(parts.scheme ?? ""),
              let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.port == nil,
              parts.path.isEmpty, parts.query == nil, parts.fragment == nil else { return nil }
        return origin
    }

    func authenticated(with token: String) -> Bool {
        // Permit origin-less native test clients; webpage origins are always rejected.
        guard headers["origin"] == nil || allowedOrigin != nil else { return false }
        let supplied = Array((headers["authorization"] ?? "").utf8)
        let expected = Array("Bearer \(token)".utf8)
        guard supplied.count == expected.count else { return false }
        return zip(supplied, expected).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
    }
}
