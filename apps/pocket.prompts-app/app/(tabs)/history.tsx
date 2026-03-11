import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Linking,
} from 'react-native';
import { get_history, type HistoryEntry } from '@/src/api/history';
import { get_member_id } from '@/src/lib/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

function format_time(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = Colors[scheme];

  const [entries, set_entries] = useState<HistoryEntry[]>([]);
  const [loading, set_loading] = useState(true);
  const [refreshing, set_refreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const member = await get_member_id();
      const data = await get_history(member || undefined);
      set_entries(data);
    } catch (err) {
      console.warn('[history] fetch failed:', err);
    } finally {
      set_loading(false);
      set_refreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const on_refresh = useCallback(() => {
    set_refreshing(true);
    load();
  }, [load]);

  const render_item = ({ item }: { item: HistoryEntry }) => (
    <Pressable
      style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
      onPress={item.entry_url ? () => Linking.openURL(item.entry_url!) : undefined}
    >
      <View style={styles.item_header}>
        <Text style={[styles.intent_badge, { color: colors.accent }]}>
          {item.intent || item.action_taken}
        </Text>
        <Text style={[styles.time, { color: colors.textSecondary }]}>
          {format_time(item.timestamp)}
        </Text>
      </View>
      <Text style={[styles.utterance, { color: colors.text }]} numberOfLines={2}>
        {item.utterance}
      </Text>
      <Text style={[styles.response, { color: colors.textSecondary }]} numberOfLines={2}>
        {item.spoken_response}
      </Text>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={render_item}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={on_refresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              no history yet — try speaking a command
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  list: { padding: 16, gap: 10 },
  item: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  item_header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  intent_badge: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  time: {
    fontSize: 11,
  },
  utterance: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  response: {
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    fontSize: 14,
    textAlign: 'center',
  },
});
