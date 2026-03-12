import { useEffect, useRef } from 'react';
import RemoteCommandModule from '@/modules/remote-command';

export type RemoteCommand =
  | 'togglePlayPause'   // single AirPod tap
  | 'play'              // play command
  | 'pause'             // pause command
  | 'nextTrack'         // double tap / squeeze-twice
  | 'previousTrack';    // triple tap

/**
 * Listens for AirPod / Bluetooth headphone remote commands and fires
 * the callback. On web this is a no-op.
 *
 * The module automatically plays a nearly-silent audio loop to claim
 * "now playing" status:
 *   - iOS:    MPRemoteCommandCenter + AVAudioSession
 *   - Android: MediaSession + AudioFocus + MediaPlayer
 *
 * Typical mapping:
 *   togglePlayPause → toggle mic (start/stop recording)
 *   play            → start recording
 *   pause           → stop recording
 *   nextTrack       → (reserved for future use)
 *
 * Tested with: AirPods Pro 4, Google Pixel Buds Pro
 */
export function useRemoteCommand(on_command: (cmd: RemoteCommand) => void) {
  // ref so the latest callback is always used without re-subscribing
  const callback_ref = useRef(on_command);
  callback_ref.current = on_command;

  useEffect(() => {
    RemoteCommandModule.enable();

    const sub = RemoteCommandModule.addListener(
      'onRemoteCommand',
      (event: { command: RemoteCommand }) => {
        callback_ref.current(event.command);
      }
    );

    return () => {
      sub.remove();
      RemoteCommandModule.disable();
    };
  }, []);  // mount/unmount only — callback accessed via ref
}
