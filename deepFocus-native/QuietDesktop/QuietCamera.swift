import AppKit
import AVFoundation
import Vision

/// Owns camera resources on one queue. The lock is only a cancellation token, never image storage.
final class QuietCamera: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    private let queue = DispatchQueue(label: "QuietDesktop.capture", qos: .utility)
    private let tokenLock = NSLock()
    private var token: UInt64?
    private var session: AVCaptureSession?
    private var cameraID = ""
    private var lastSample: TimeInterval = 0
    var observation: ((QuietObservation, QuietGeometry?, Date, UInt64) -> Void)?
    var failure: ((String, UInt64) -> Void)?
    private func currentToken() -> UInt64? { tokenLock.lock(); defer { tokenLock.unlock() }; return token }
    func start(generation: UInt64) {
        tokenLock.lock(); token = generation; tokenLock.unlock()
        queue.async { [weak self] in
            guard let self, self.currentToken() == generation else { return }
            self.releaseSession()
            guard let device = AVCaptureDevice.default(for: .video) else { self.fail("No camera is available.", generation); return }
            do {
                let input = try AVCaptureDeviceInput(device: device)
                let output = AVCaptureVideoDataOutput()
                output.alwaysDiscardsLateVideoFrames = true
                output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
                output.setSampleBufferDelegate(self, queue: self.queue)
                let capture = AVCaptureSession()
                capture.sessionPreset = .vga640x480
                guard capture.canAddInput(input), capture.canAddOutput(output) else { self.fail("This camera cannot provide usable frames.", generation); return }
                capture.addInput(input); capture.addOutput(output)
                if let connection = output.connection(with: .video), connection.isVideoMirroringSupported {
                    connection.automaticallyAdjustsVideoMirroring = false; connection.isVideoMirrored = false
                }
                guard self.currentToken() == generation else { return }
                self.cameraID = device.uniqueID; self.lastSample = 0; self.session = capture
                capture.startRunning()
                if self.currentToken() != generation { self.releaseSession() }
                else if !capture.isRunning { self.fail("Camera capture did not start. Press Start to retry.", generation) }
            } catch { self.fail("Unable to open camera. Check camera permission, then press Start.", generation) }
        }
    }
    func stop(completion: @escaping () -> Void) {
        tokenLock.lock(); token = nil; tokenLock.unlock()
        queue.async { [weak self] in
            self?.releaseSession()
            DispatchQueue.main.async(execute: completion)
        }
    }
    private func releaseSession() {
        guard let capture = session else { return }
        for output in capture.outputs { (output as? AVCaptureVideoDataOutput)?.setSampleBufferDelegate(nil, queue: nil) }
        if capture.isRunning { capture.stopRunning() }
        capture.inputs.forEach { capture.removeInput($0) }; capture.outputs.forEach { capture.removeOutput($0) }
        session = nil
    }
    private func fail(_ message: String, _ generation: UInt64) {
        releaseSession()
        DispatchQueue.main.async { [weak self] in self?.failure?(message, generation) }
    }
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let generation = currentToken() else { return }
        let uptime = ProcessInfo.processInfo.systemUptime
        guard uptime - lastSample >= 1.0 / 3.0 else { return }
        lastSample = uptime
        let capturedAt = Date()
        guard let pixels = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        var result: QuietObservation = .uncertain
        var geometry: QuietGeometry?
        if usableLighting(pixels) {
            let body = VNDetectHumanBodyPoseRequest()
            let people = VNDetectHumanRectanglesRequest(); people.upperBodyOnly = true
            let faces = VNDetectFaceRectanglesRequest()
            do {
                guard currentToken() == generation else { return }
                try VNImageRequestHandler(cvPixelBuffer: pixels, orientation: .up).perform([body, people, faces])
                let persons = (people.results ?? []).filter { $0.confidence >= 0.2 }
                let faceCount = (faces.results ?? []).filter { $0.confidence >= 0.2 }.count
                let bodies = body.results ?? []
                if persons.isEmpty && faceCount == 0 && bodies.isEmpty { result = .absent }
                else if persons.count <= 1 && faceCount <= 1 && bodies.count == 1,
                        let points = try? bodies[0].recognizedPoints(.all),
                        let nose = points[.nose], let left = points[.leftShoulder], let right = points[.rightShoulder],
                        usablePoint(nose) && usablePoint(left) && usablePoint(right) {
                    let width = hypot(left.location.x - right.location.x, left.location.y - right.location.y)
                    if width >= 0.15 {
                        let mx = (left.location.x + right.location.x) / 2; let my = (left.location.y + right.location.y) / 2
                        result = .person(x: (nose.location.x - mx) / width, y: (nose.location.y - my) / width,
                                         confidence: Double(min(nose.confidence, min(left.confidence, right.confidence))))
                        geometry = QuietGeometry(camera: cameraID, width: CVPixelBufferGetWidth(pixels), height: CVPixelBufferGetHeight(pixels), mirrored: connection.isVideoMirrored,
                                                 shoulderWidth: width, midpointX: mx, midpointY: my)
                    }
                }
            } catch { result = .uncertain }
        }
        guard currentToken() == generation else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, self.currentToken() == generation else { return }
            self.observation?(result, geometry, capturedAt, generation)
        }
    }
    private func usablePoint(_ point: VNRecognizedPoint) -> Bool {
        let location = point.location
        return point.confidence >= 0.7 && location.x > 0.03 && location.x < 0.97 && location.y > 0.03 && location.y < 0.97
    }
    /// Reject dark, blown-out and featureless frames conservatively. This cannot prove absence.
    private func usableLighting(_ pixels: CVPixelBuffer) -> Bool {
        CVPixelBufferLockBaseAddress(pixels, .readOnly); defer { CVPixelBufferUnlockBaseAddress(pixels, .readOnly) }
        guard let address = CVPixelBufferGetBaseAddress(pixels) else { return false }
        let data = address.assumingMemoryBound(to: UInt8.self)
        let width = CVPixelBufferGetWidth(pixels), height = CVPixelBufferGetHeight(pixels), stride = CVPixelBufferGetBytesPerRow(pixels)
        var sum = 0.0, square = 0.0, count = 0.0
        for y in Swift.stride(from: 0, to: height, by: 16) {
            for x in Swift.stride(from: 0, to: width, by: 16) {
                let offset = y * stride + x * 4
                let value = (Double(data[offset]) + Double(data[offset + 1]) + Double(data[offset + 2])) / 3
                sum += value; square += value * value; count += 1
            }
        }
        let mean = sum / max(1, count)
        return mean >= 35 && mean <= 225 && square / max(1, count) - mean * mean >= 100
    }
}
