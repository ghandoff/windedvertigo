import { useCallback, useState } from 'react';
import * as Speech from 'expo-speech';

interface UseTtsResult {
  speak: (text: string) => void;
  stop: () => void;
  is_speaking: boolean;
}

export function useTts(): UseTtsResult {
  const [is_speaking, set_is_speaking] = useState(false);

  const speak = useCallback((text: string) => {
    // stop any current speech first
    Speech.stop();

    set_is_speaking(true);
    Speech.speak(text, {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
      onDone: () => set_is_speaking(false),
      onError: () => set_is_speaking(false),
      onStopped: () => set_is_speaking(false),
    });
  }, []);

  const stop = useCallback(() => {
    Speech.stop();
    set_is_speaking(false);
  }, []);

  return { speak, stop, is_speaking };
}
