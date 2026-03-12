package expo.modules.remotecommand

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.view.KeyEvent

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

import java.io.File
import java.io.FileOutputStream

/**
 * Android native module that captures Bluetooth headphone media button events
 * (play/pause, next, previous) via MediaSession and bridges them to React
 * Native as events — mirror of the iOS RemoteCommandModule.
 *
 * To receive media button events, the app must be the active "now playing"
 * app. We achieve this by:
 *   1. Creating a MediaSession with an active PlaybackState
 *   2. Requesting audio focus
 *   3. Playing a nearly-silent audio loop
 *
 * Pixel Buds Pro mapping:
 *   single tap    → KEYCODE_MEDIA_PLAY_PAUSE → "togglePlayPause"
 *   (double tap   → KEYCODE_MEDIA_NEXT      → "nextTrack" — if configured)
 *   long press    → Google Assistant (not capturable)
 */
class RemoteCommandModule : Module() {
  private var mediaSession: MediaSession? = null
  private var mediaPlayer: MediaPlayer? = null
  private var audioFocusRequest: AudioFocusRequest? = null
  private var isModuleEnabled = false

  override fun definition() = ModuleDefinition {
    Name("RemoteCommand")

    Events("onRemoteCommand")

    Function("enable") {
      if (isModuleEnabled) return@Function
      isModuleEnabled = true
      setupMediaSession()
      startSilentPlayback()
    }

    Function("disable") {
      teardown()
    }

    Function("isEnabled") {
      isModuleEnabled
    }

    OnDestroy {
      teardown()
    }
  }

  // ── helpers ──────────────────────────────────────────────────────

  private fun emitCommand(command: String) {
    sendEvent("onRemoteCommand", mapOf("command" to command))
  }

  // ── media session ────────────────────────────────────────────────

  private fun setupMediaSession() {
    val context = appContext.reactContext ?: return

    mediaSession = MediaSession(context, "PocketPrompts").apply {
      // intercept raw media button key events for maximum control
      setCallback(object : MediaSession.Callback() {
        override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
          val event = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            mediaButtonIntent.getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent::class.java)
          } else {
            @Suppress("DEPRECATION")
            mediaButtonIntent.getParcelableExtra(Intent.EXTRA_KEY_EVENT)
          }

          if (event == null || event.action != KeyEvent.ACTION_DOWN) return false

          when (event.keyCode) {
            // all play/pause variants → togglePlayPause (matches iOS single-tap behavior)
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            KeyEvent.KEYCODE_HEADSETHOOK,
            KeyEvent.KEYCODE_MEDIA_PLAY,
            KeyEvent.KEYCODE_MEDIA_PAUSE -> {
              emitCommand("togglePlayPause")
              return true
            }
            KeyEvent.KEYCODE_MEDIA_NEXT -> {
              emitCommand("nextTrack")
              return true
            }
            KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
              emitCommand("previousTrack")
              return true
            }
          }
          return false
        }
      })

      // set playback state to PLAYING so media buttons route to this session
      setPlaybackState(
        PlaybackState.Builder()
          .setState(PlaybackState.STATE_PLAYING, 0, 1f)
          .setActions(
            PlaybackState.ACTION_PLAY or
            PlaybackState.ACTION_PAUSE or
            PlaybackState.ACTION_PLAY_PAUSE or
            PlaybackState.ACTION_SKIP_TO_NEXT or
            PlaybackState.ACTION_SKIP_TO_PREVIOUS
          )
          .build()
      )

      isActive = true
    }
  }

  // ── silent audio playback ────────────────────────────────────────

  private fun startSilentPlayback() {
    val context = appContext.reactContext ?: return
    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    // request transient audio focus with ducking — this lowers the volume
    // of other audio (music, podcasts) instead of pausing it, so the user's
    // media keeps playing while we hold "now playing" status for headphone
    // button capture. matches the iOS module's .mixWithOthers behavior.
    audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build()
      )
      .setOnAudioFocusChangeListener { focusChange ->
        // if we lose focus temporarily, try to resume when we get it back
        if (focusChange == AudioManager.AUDIOFOCUS_GAIN && isModuleEnabled) {
          mediaPlayer?.let { if (!it.isPlaying) it.start() }
        }
      }
      .build()

    audioManager.requestAudioFocus(audioFocusRequest!!)

    // generate + play a 1-second silent WAV loop
    val silentFile = getOrCreateSilentWav(context) ?: return
    try {
      mediaPlayer = MediaPlayer().apply {
        setDataSource(silentFile.absolutePath)
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        )
        isLooping = true
        setVolume(0.01f, 0.01f) // nearly silent
        prepare()
        start()
      }
    } catch (e: Exception) {
      android.util.Log.e("RemoteCommand", "silent playback failed: ${e.message}")
    }
  }

  // ── silent WAV generator ─────────────────────────────────────────

  /**
   * Generate a minimal 1-second silent WAV file in the cache directory.
   * 8 kHz mono 8-bit PCM — same format as the iOS module's silentAudioURL().
   * 8-bit unsigned PCM silence = 128 (0x80).
   */
  private fun getOrCreateSilentWav(context: Context): File? {
    val file = File(context.cacheDir, "pp_silence.wav")
    if (file.exists()) return file

    try {
      val sampleRate = 8000
      val numSamples = sampleRate      // 1 second
      val bitsPerSample = 8
      val numChannels = 1
      val dataSize = numSamples * numChannels * (bitsPerSample / 8)

      FileOutputStream(file).use { out ->
        // RIFF header
        out.write("RIFF".toByteArray())
        writeLE32(out, 36 + dataSize)
        out.write("WAVE".toByteArray())

        // fmt subchunk
        out.write("fmt ".toByteArray())
        writeLE32(out, 16)             // subchunk size
        writeLE16(out, 1)              // PCM format
        writeLE16(out, numChannels)
        writeLE32(out, sampleRate)
        writeLE32(out, sampleRate * numChannels * (bitsPerSample / 8)) // byte rate
        writeLE16(out, numChannels * (bitsPerSample / 8))              // block align
        writeLE16(out, bitsPerSample)

        // data subchunk — 8-bit unsigned silence = 128 (0x80)
        out.write("data".toByteArray())
        writeLE32(out, dataSize)
        out.write(ByteArray(dataSize) { 0x80.toByte() })
      }

      return file
    } catch (e: Exception) {
      android.util.Log.e("RemoteCommand", "failed to create silent wav: ${e.message}")
      return null
    }
  }

  private fun writeLE16(out: FileOutputStream, value: Int) {
    out.write(value and 0xFF)
    out.write((value shr 8) and 0xFF)
  }

  private fun writeLE32(out: FileOutputStream, value: Int) {
    out.write(value and 0xFF)
    out.write((value shr 8) and 0xFF)
    out.write((value shr 16) and 0xFF)
    out.write((value shr 24) and 0xFF)
  }

  // ── teardown ─────────────────────────────────────────────────────

  private fun teardown() {
    if (!isModuleEnabled) return
    isModuleEnabled = false

    mediaSession?.isActive = false
    mediaSession?.release()
    mediaSession = null

    mediaPlayer?.stop()
    mediaPlayer?.release()
    mediaPlayer = null

    val context = appContext.reactContext
    if (context != null && audioFocusRequest != null) {
      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.abandonAudioFocusRequest(audioFocusRequest!!)
    }
    audioFocusRequest = null
  }
}
