import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface UseSpeechResult {
  transcript: string;
  is_listening: boolean;
  is_available: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useSpeech(): UseSpeechResult {
  const [transcript, set_transcript] = useState('');
  const [is_listening, set_is_listening] = useState(false);
  const [is_available, set_is_available] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const final_ref = useRef('');

  // check availability on mount
  useEffect(() => {
    async function check() {
      const status = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (status.granted) {
        set_is_available(true);
      } else {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        set_is_available(result.granted);
      }
    }
    check();
  }, []);

  // handle speech recognition results
  // expo-speech-recognition fires { isFinal, results[] } where results[0].transcript is best match
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript || '';
    if (event.isFinal) {
      // append final results (for multi-segment recognition)
      final_ref.current = final_ref.current
        ? `${final_ref.current} ${text}`
        : text;
      set_transcript(final_ref.current);
    } else {
      // show interim + any previous finals
      const display = final_ref.current
        ? `${final_ref.current} ${text}`
        : text;
      set_transcript(display);
    }
  });

  useSpeechRecognitionEvent('start', () => {
    set_is_listening(true);
    set_error(null);
  });

  useSpeechRecognitionEvent('end', () => {
    set_is_listening(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    set_error(event.error);
    set_is_listening(false);
    console.warn('[speech] error:', event.error, event.message);
  });

  const start = useCallback(async () => {
    set_error(null);
    set_transcript('');
    final_ref.current = '';

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      // on iOS, continuous mode keeps listening until explicitly stopped
      continuous: true,
    });
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { transcript, is_listening, is_available, error, start, stop };
}
