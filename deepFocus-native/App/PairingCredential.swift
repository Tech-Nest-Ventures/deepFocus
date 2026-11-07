import Foundation
import Security

enum PairingCredential {
    /// Only the random pairing secret is persisted, in the app's sandbox with owner-only permissions.
    static func load() throws -> String {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                     appropriateFor: nil, create: true)
            .appendingPathComponent("DeepFocusNative", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        let file = directory.appendingPathComponent("pairing-token")
        if FileManager.default.fileExists(atPath: file.path) {
            let saved = try String(contentsOf: file, encoding: .utf8)
            guard saved.count == 64, saved.allSatisfy({ $0.isHexDigit }) else {
                throw CocoaError(.fileReadCorruptFile)
            }
            return saved
        }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw CocoaError(.fileWriteUnknown)
        }
        let token = bytes.map { String(format: "%02x", $0) }.joined()
        // Set permissions before creating the file, rather than briefly exposing it during a chmod.
        guard FileManager.default.createFile(atPath: file.path, contents: Data(token.utf8),
                                             attributes: [.posixPermissions: 0o600]) else {
            throw CocoaError(.fileWriteUnknown)
        }
        return token
    }
}
