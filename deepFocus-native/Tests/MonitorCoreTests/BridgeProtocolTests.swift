import XCTest
@testable import MonitorCore

final class BridgeProtocolTests: XCTestCase {
    let token = String(repeating: "a", count: 64)
    func request(_ headers: String = "", body: String = "", method: String = "POST") -> Data {
        Data("\(method) /v1/event HTTP/1.1\r\nHost: 127.0.0.1:17322\r\n\(headers)Content-Length: \(body.utf8.count)\r\n\r\n\(body)".utf8)
    }

    func testPartialBodyWaitsAndCompleteBodyParses() throws {
        let bytes = request(body: "{\"url\":\"https://example.com\"}")
        XCTAssertNil(try BridgeRequest.parse(bytes.dropLast(3)))
        XCTAssertEqual(try BridgeRequest.parse(bytes)?.body, Data("{\"url\":\"https://example.com\"}".utf8))
    }

    func testTokenAndOriginValidation() throws {
        let authorization = "Authorization: Bearer \(token)\r\n"
        for origin in ["chrome-extension://abcdefghijklmnop", "safari-web-extension://12345678-1234"] {
            let parsed = try XCTUnwrap(BridgeRequest.parse(request(authorization + "Origin: \(origin)\r\n")))
            XCTAssertTrue(parsed.authenticated(with: token))
            XCTAssertFalse(parsed.authenticated(with: String(repeating: "b", count: 64)))
            XCTAssertEqual(parsed.allowedOrigin, origin)
        }
        for origin in ["https://example.com", "null", "http://127.0.0.1", "chrome-extension://host/path"] {
            let parsed = try XCTUnwrap(BridgeRequest.parse(request(authorization + "Origin: \(origin)\r\n")))
            XCTAssertFalse(parsed.authenticated(with: token))
        }
        let missing = try XCTUnwrap(BridgeRequest.parse(request()))
        XCTAssertFalse(missing.authenticated(with: token))
    }

    func testSmugglingAndMalformedRequestsRejected() {
        for header in ["Content-Length: 0\r\n", "Transfer-Encoding: chunked\r\n", "Host: evil.example\r\n", "bad header: value\r\n", "no colon\r\n"] {
            XCTAssertThrowsError(try BridgeRequest.parse(request(header)))
        }
        XCTAssertThrowsError(try BridgeRequest.parse(request() + Data("extra bytes".utf8)))
        XCTAssertThrowsError(try BridgeRequest.parse(Data(repeating: 65, count: 30_000)))
        XCTAssertThrowsError(try BridgeRequest.parse(Data("GET /v1/status HTTP/1.1\r\nHost: evil.example\r\n\r\n".utf8)))
    }

    func testMalformedBrowserPayloadIsNotDecoded() {
        for json in ["{}", "{\"browser\":\"unknown\"}", "[]", "null"] {
            XCTAssertThrowsError(try JSONDecoder().decode(BrowserEvent.self, from: Data(json.utf8)))
        }
    }
}
