import ExpoModulesCore
import MediaPlayer
import AVFoundation

/// Native module that captures AirPod / Bluetooth headphone remote commands
/// (play, pause, toggle, next track) via MPRemoteCommandCenter and bridges
/// them to React Native as events.
///
/// To receive commands, the app must be the "now playing" app. We achieve
/// this by playing a nearly-silent audio loop and setting NowPlayingInfo.
public class RemoteCommandModule: Module {
  private var audioPlayer: AVAudioPlayer?
  private var isEnabled = false

  public func definition() -> ModuleDefinition {
    Name("RemoteCommand")

    Events("onRemoteCommand")

    Function("enable") { () -> Void in
      guard !self.isEnabled else { return }
      self.isEnabled = true
      self.setupAudioSession()
      self.setupRemoteCommands()
      self.setupNowPlaying()
    }

    Function("disable") { () -> Void in
      self.teardown()
    }

    Function("isEnabled") { () -> Bool in
      return self.isEnabled
    }

    OnDestroy {
      self.teardown()
    }
  }

  // MARK: - Audio session

  private func setupAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(
        .playAndRecord,
        options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP, .mixWithOthers]
      )
      try session.setActive(true, options: [])
    } catch {
      print("[RemoteCommand] audio session setup failed: \(error)")
    }

    // re-enable after interruptions (e.g. phone call, Siri)
    NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard let info = notification.userInfo,
            let typeRaw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: typeRaw) else { return }

      if type == .ended {
        self?.resumeSilentPlayback()
      }
    }
  }

  // MARK: - Remote commands

  private func setupRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()

    // single AirPod tap → togglePlayPause
    center.togglePlayPauseCommand.isEnabled = true
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      self?.sendEvent("onRemoteCommand", ["command": "togglePlayPause"])
      return .success
    }

    center.playCommand.isEnabled = true
    center.playCommand.addTarget { [weak self] _ in
      self?.sendEvent("onRemoteCommand", ["command": "play"])
      return .success
    }

    center.pauseCommand.isEnabled = true
    center.pauseCommand.addTarget { [weak self] _ in
      self?.sendEvent("onRemoteCommand", ["command": "pause"])
      return .success
    }

    // double tap (AirPods Pro: squeeze-twice) → nextTrack
    center.nextTrackCommand.isEnabled = true
    center.nextTrackCommand.addTarget { [weak self] _ in
      self?.sendEvent("onRemoteCommand", ["command": "nextTrack"])
      return .success
    }

    // triple tap → previousTrack
    center.previousTrackCommand.isEnabled = true
    center.previousTrackCommand.addTarget { [weak self] _ in
      self?.sendEvent("onRemoteCommand", ["command": "previousTrack"])
      return .success
    }
  }

  // MARK: - Now Playing (claims "now playing" status so remote commands arrive)

  private func setupNowPlaying() {
    var info = [String: Any]()
    info[MPMediaItemPropertyTitle] = "pocket.prompts"
    info[MPMediaItemPropertyArtist] = "ready"
    info[MPNowPlayingInfoPropertyIsLiveStream] = true
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info

    startSilentPlayback()
  }

  /// Play a generated silent WAV to claim "now playing" status.
  /// Without this, MPRemoteCommandCenter won't deliver events.
  private func startSilentPlayback() {
    guard let url = silentAudioURL() else { return }
    do {
      audioPlayer = try AVAudioPlayer(contentsOf: url)
      audioPlayer?.numberOfLoops = -1   // loop forever
      audioPlayer?.volume = 0.01        // nearly silent
      audioPlayer?.play()
    } catch {
      print("[RemoteCommand] silent playback failed: \(error)")
    }
  }

  private func resumeSilentPlayback() {
    guard isEnabled else { return }
    try? AVAudioSession.sharedInstance().setActive(true, options: [])
    if audioPlayer?.isPlaying == false {
      audioPlayer?.play()
    }
  }

  /// Generate a minimal 1-second silent WAV file in the temp directory.
  /// 8 kHz mono 8-bit PCM — tiny and sufficient to hold "now playing" status.
  private func silentAudioURL() -> URL? {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("pp_silence.wav")
    if FileManager.default.fileExists(atPath: url.path) { return url }

    let sampleRate: UInt32 = 8000
    let numSamples = sampleRate          // 1 second
    let bitsPerSample: UInt16 = 8
    let numChannels: UInt16 = 1
    let dataSize = numSamples * UInt32(numChannels) * UInt32(bitsPerSample / 8)

    var d = Data()

    // RIFF header
    d.append(contentsOf: "RIFF".utf8)
    appendLE(&d, UInt32(36 + dataSize))
    d.append(contentsOf: "WAVE".utf8)

    // fmt subchunk
    d.append(contentsOf: "fmt ".utf8)
    appendLE(&d, UInt32(16))         // subchunk size
    appendLE(&d, UInt16(1))          // PCM format
    appendLE(&d, numChannels)
    appendLE(&d, sampleRate)
    appendLE(&d, sampleRate * UInt32(numChannels) * UInt32(bitsPerSample / 8)) // byte rate
    appendLE(&d, UInt16(numChannels * bitsPerSample / 8))                       // block align
    appendLE(&d, bitsPerSample)

    // data subchunk — 8-bit silence is 128 (center of unsigned range)
    d.append(contentsOf: "data".utf8)
    appendLE(&d, dataSize)
    d.append(Data(repeating: 128, count: Int(dataSize)))

    try? d.write(to: url)
    return url
  }

  private func appendLE<T: FixedWidthInteger>(_ data: inout Data, _ value: T) {
    var le = value.littleEndian
    data.append(Data(bytes: &le, count: MemoryLayout<T>.size))
  }

  // MARK: - Teardown

  private func teardown() {
    guard isEnabled else { return }
    isEnabled = false

    let center = MPRemoteCommandCenter.shared()
    center.togglePlayPauseCommand.removeTarget(nil)
    center.playCommand.removeTarget(nil)
    center.pauseCommand.removeTarget(nil)
    center.nextTrackCommand.removeTarget(nil)
    center.previousTrackCommand.removeTarget(nil)

    audioPlayer?.stop()
    audioPlayer = nil

    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    NotificationCenter.default.removeObserver(self)
  }
}
