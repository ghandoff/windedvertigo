import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useSpeech } from '@/src/hooks/use-speech';
import { useTts } from '@/src/hooks/use-tts';
import { send_voice, type VoiceResponse } from '@/src/api/voice';
import { get_member_id } from '@/src/lib/storage';
import { MicButton } from '@/src/components/mic-button';
import { Transcript } from '@/src/components/transcript';
import { ResponseCard } from '@/src/components/response-card';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Phase = 'idle' | 'listening' | 'processing' | 'speaking';

export default function VoiceScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = Colors[scheme];

  const speech = useSpeech();
  const tts = useTts();

  const [phase, set_phase] = useState<Phase>('idle');
  const [member_id, set_member_id] = useState<string | null>(null);
  const [response, set_response] = useState<VoiceResponse | null>(null);
  const [error_msg, set_error_msg] = useState<string | null>(null);

  // load saved member on mount
  useEffect(() => {
    get_member_id().then(set_member_id);
  }, []);

  // when speech recognition stops, send the transcript to the API
  useEffect(() => {
    if (phase === 'listening' && !speech.is_listening && speech.transcript) {
      // mic stopped — send to API
      handle_send(speech.transcript);
    }
  }, [speech.is_listening, phase]);

  const handle_send = useCallback(async (text: string) => {
    if (!text.trim()) {
      set_phase('idle');
      return;
    }

    set_phase('processing');
    set_error_msg(null);

    try {
      const user = member_id || 'garrett'; // fallback to garrett if no member selected
      const result = await send_voice(text, user);
      set_response(result);
      set_phase('speaking');

      // speak the response
      tts.speak(result.spoken_response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'something went wrong';
      set_error_msg(msg);
      set_phase('idle');
    }
  }, [member_id, tts]);

  // transition from speaking back to idle when TTS finishes
  useEffect(() => {
    if (phase === 'speaking' && !tts.is_speaking) {
      set_phase('idle');
    }
  }, [tts.is_speaking, phase]);

  const handle_mic_press = useCallback(async () => {
    if (phase === 'listening') {
      // stop recording — will trigger send via useEffect
      speech.stop();
    } else if (phase === 'speaking') {
      // interrupt speech
      tts.stop();
      set_phase('idle');
    } else if (phase === 'idle') {
      set_response(null);
      set_error_msg(null);
      set_phase('listening');
      await speech.start();
    }
  }, [phase, speech, tts]);

  const status_text = {
    idle: member_id ? `signed in as ${member_id}` : 'tap to speak',
    listening: 'listening...',
    processing: 'thinking...',
    speaking: 'speaking...',
  }[phase];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll_content}
        showsVerticalScrollIndicator={false}
      >
        {/* status */}
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {status_text}
        </Text>

        {/* transcript */}
        <Transcript
          text={speech.transcript}
          is_listening={phase === 'listening'}
          colors={colors}
        />

        {/* response card */}
        {response && (
          <ResponseCard response={response} colors={colors} />
        )}

        {/* error */}
        {error_msg && (
          <View style={styles.error_container}>
            <Text style={[styles.error_text, { color: colors.error }]}>
              {error_msg}
            </Text>
          </View>
        )}

        {/* speech recognition unavailable */}
        {!speech.is_available && (
          <View style={styles.error_container}>
            <Text style={[styles.error_text, { color: colors.warning }]}>
              speech recognition not available — check permissions
            </Text>
          </View>
        )}
      </ScrollView>

      {/* mic button — pinned to bottom */}
      <View style={styles.mic_area}>
        <MicButton
          is_listening={phase === 'listening'}
          is_processing={phase === 'processing'}
          on_press={handle_mic_press}
          color_active={colors.micButtonActive}
          color_idle={colors.micButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll_content: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 160, // space for mic button
  },
  status: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'lowercase',
  },
  error_container: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  error_text: {
    fontSize: 14,
    textAlign: 'center',
  },
  mic_area: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
