import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSpeech } from '@/src/hooks/use-speech';
import { useTts } from '@/src/hooks/use-tts';
import { useRemoteCommand } from '@/src/hooks/use-remote-command';
import { useAppState } from '@/src/hooks/use-app-state';
import { send_voice } from '@/src/api/voice';
import { get_history, type HistoryEntry, type HistoryResponse } from '@/src/api/history';
import { get_member_id } from '@/src/lib/storage';
import { MicButton } from '@/src/components/mic-button';
import { ChatBubble, DateSeparator } from '@/src/components/chat-bubble';
import { Transcript } from '@/src/components/transcript';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Phase = 'idle' | 'listening' | 'processing' | 'speaking';

// --- date grouping ---

function get_date_key(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entry_day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff_days = Math.floor((today.getTime() - entry_day.getTime()) / 86400000);

  if (diff_days === 0) return 'today';
  if (diff_days === 1) return 'yesterday';
  if (diff_days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toLowerCase();
}

type ListItem =
  | { type: 'message'; entry: HistoryEntry }
  | { type: 'date'; label: string };

function build_list_items(entries: HistoryEntry[]): ListItem[] {
  // entries are newest-first; inverted FlatList renders bottom-to-top.
  // date separators go at group boundaries.
  const items: ListItem[] = [];
  let last_key = '';

  for (const entry of entries) {
    const key = get_date_key(entry.timestamp || entry.created_time);
    if (key !== last_key) {
      if (last_key) items.push({ type: 'date', label: last_key });
      last_key = key;
    }
    items.push({ type: 'message', entry });
  }
  if (last_key) items.push({ type: 'date', label: last_key });

  return items;
}

// --- component ---

export default function ChatScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = Colors[scheme];

  const speech = useSpeech();
  const tts = useTts();

  const [phase, set_phase] = useState<Phase>('idle');
  const [member_id, set_member_id] = useState<string | null>(null);
  const [entries, set_entries] = useState<HistoryEntry[]>([]);
  const [loading, set_loading] = useState(true);
  const [refreshing, set_refreshing] = useState(false);
  const [loading_more, set_loading_more] = useState(false);
  const cursor_ref = useRef<string | null>(null);
  const has_more_ref = useRef(false);

  useEffect(() => {
    get_member_id().then(set_member_id);
  }, []);

  // --- history ---

  const load_history = useCallback(async (append = false) => {
    try {
      const member = await get_member_id();
      const data: HistoryResponse = await get_history(
        member || undefined,
        append ? cursor_ref.current || undefined : undefined,
      );
      cursor_ref.current = data.next_cursor;
      has_more_ref.current = data.has_more;

      if (append) {
        set_entries(prev => [...prev, ...data.entries]);
      } else {
        set_entries(data.entries);
      }
    } catch (err) {
      console.warn('[chat] history fetch failed:', err);
    } finally {
      set_loading(false);
      set_refreshing(false);
      set_loading_more(false);
    }
  }, []);

  useEffect(() => { load_history(); }, [load_history]);

  // refresh on foreground
  useAppState(useCallback((state) => {
    if (state === 'active') load_history();
  }, [load_history]));

  const on_refresh = useCallback(() => {
    set_refreshing(true);
    cursor_ref.current = null;
    load_history();
  }, [load_history]);

  const on_end_reached = useCallback(() => {
    if (!has_more_ref.current || loading_more) return;
    set_loading_more(true);
    load_history(true);
  }, [load_history, loading_more]);

  // --- voice ---

  const handle_send = useCallback(async (text: string) => {
    if (!text.trim()) {
      set_phase('idle');
      return;
    }

    set_phase('processing');

    try {
      const user = member_id || 'garrett';
      const result = await send_voice(text, user);
      set_phase('speaking');
      tts.speak(result.spoken_response);

      // optimistic insert so the message appears immediately
      const now = new Date().toISOString();
      const optimistic: HistoryEntry = {
        id: `local-${Date.now()}`,
        timestamp: now,
        created_time: now,
        utterance: null,
        intent: result.intent_result?.intent || null,
        confidence: result.intent_result?.confidence ?? null,
        action_taken: result.action_taken,
        priority: result.intent_result?.priority || null,
        entry_url: result.entry_url || null,
        user_id: user,
        error: result.error || null,
        duration_ms: null,
        platform: 'expo',
        content: text,
        spoken_response: result.spoken_response,
      };
      set_entries(prev => [optimistic, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'something went wrong';
      const now = new Date().toISOString();
      const error_entry: HistoryEntry = {
        id: `error-${Date.now()}`,
        timestamp: now,
        created_time: now,
        utterance: null,
        intent: null,
        confidence: null,
        action_taken: 'error',
        priority: null,
        entry_url: null,
        user_id: member_id,
        error: msg,
        duration_ms: null,
        platform: 'expo',
        content: text,
        spoken_response: null,
      };
      set_entries(prev => [error_entry, ...prev]);
      set_phase('idle');
    }
  }, [member_id, tts]);

  const send_ref = useRef(handle_send);
  send_ref.current = handle_send;

  useEffect(() => {
    if (phase === 'listening' && !speech.is_listening && speech.transcript) {
      send_ref.current(speech.transcript);
    }
  }, [speech.is_listening, phase]);

  useEffect(() => {
    if (phase === 'speaking' && !tts.is_speaking) {
      set_phase('idle');
    }
  }, [tts.is_speaking, phase]);

  const handle_mic_press = useCallback(async () => {
    if (phase === 'listening') {
      speech.stop();
    } else if (phase === 'speaking') {
      tts.stop();
      set_phase('idle');
    } else if (phase === 'idle') {
      set_phase('listening');
      await speech.start();
    }
  }, [phase, speech, tts]);

  useRemoteCommand(useCallback((cmd) => {
    if (cmd === 'togglePlayPause') {
      handle_mic_press();
    } else if (cmd === 'play') {
      if (phase === 'idle') handle_mic_press();
    } else if (cmd === 'pause') {
      if (phase === 'listening') handle_mic_press();
    }
  }, [handle_mic_press, phase]));

  // --- render ---

  const list_items = build_list_items(entries);

  const status_text = phase === 'idle' ? '' : {
    listening: 'listening...',
    processing: 'thinking...',
    speaking: 'speaking...',
  }[phase];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* chat messages (inverted — newest at bottom) */}
      <FlatList
        data={list_items}
        inverted
        keyExtractor={(item, i) =>
          item.type === 'date' ? `date-${item.label}-${i}` : item.entry.id
        }
        renderItem={({ item }) => {
          if (item.type === 'date') {
            return <DateSeparator label={item.label} colors={colors} />;
          }
          return <ChatBubble entry={item.entry} colors={colors} />;
        }}
        contentContainerStyle={styles.list_content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={on_refresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={on_end_reached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading_more ? (
            <View style={styles.loader}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.empty_title, { color: colors.text }]}>
              no messages yet
            </Text>
            <Text style={[styles.empty_desc, { color: colors.textSecondary }]}>
              tap the mic and start talking
            </Text>
          </View>
        }
      />

      {/* bottom bar: transcript + mic */}
      <View style={[styles.bottom_bar, { borderTopColor: colors.surfaceBorder }]}>
        {phase !== 'idle' && (
          <Transcript
            text={speech.transcript}
            is_listening={phase === 'listening'}
            colors={colors}
          />
        )}

        {status_text ? (
          <Text style={[styles.status, { color: colors.textSecondary }]}>
            {status_text}
          </Text>
        ) : null}

        {!speech.is_available && (
          <Text style={[styles.warning, { color: colors.warning }]}>
            speech recognition not available
          </Text>
        )}

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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list_content: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  loader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 8,
    transform: [{ scaleY: -1 }], // un-flip for inverted list
  },
  empty_title: {
    fontSize: 18,
    fontWeight: '600',
  },
  empty_desc: {
    fontSize: 14,
    textAlign: 'center',
  },
  bottom_bar: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  status: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'lowercase',
  },
  warning: {
    fontSize: 12,
    marginBottom: 4,
  },
});
