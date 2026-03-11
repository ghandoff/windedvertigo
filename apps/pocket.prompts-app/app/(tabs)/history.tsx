import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  RefreshControl,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { get_history, type HistoryEntry, type HistoryResponse } from '@/src/api/history';
import { get_member_id } from '@/src/lib/storage';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

// --- action labels (matches ResponseCard) ---

const action_meta: Record<string, { label: string; emoji: string; color_key: 'success' | 'error' | 'accent' }> = {
  notion_note: { label: 'note', emoji: '📝', color_key: 'success' },
  notion_idea: { label: 'idea', emoji: '💡', color_key: 'success' },
  notion_task: { label: 'task', emoji: '✅', color_key: 'success' },
  slack_check: { label: 'slack', emoji: '💬', color_key: 'accent' },
  slack_message: { label: 'sent', emoji: '📨', color_key: 'success' },
  slack_reply: { label: 'reply', emoji: '↩️', color_key: 'success' },
  code_conversation: { label: 'code', emoji: '💻', color_key: 'accent' },
  build_approval: { label: 'build', emoji: '🔨', color_key: 'success' },
  clarification_needed: { label: 'unclear', emoji: '❓', color_key: 'accent' },
  exit: { label: 'exit', emoji: '👋', color_key: 'accent' },
  error: { label: 'error', emoji: '⚠️', color_key: 'error' },
};

// --- date helpers ---

function get_section_key(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entry_day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff_days = Math.floor((today.getTime() - entry_day.getTime()) / 86400000);

  if (diff_days === 0) return 'Today';
  if (diff_days === 1) return 'Yesterday';
  if (diff_days < 7) return 'This Week';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function format_time(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function group_by_section(entries: HistoryEntry[]): { title: string; data: HistoryEntry[] }[] {
  const map = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const key = get_section_key(e.timestamp || e.created_time);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map, ([title, data]) => ({ title, data }));
}

// --- component ---

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? 'dark';
  const colors = Colors[scheme];

  const [entries, set_entries] = useState<HistoryEntry[]>([]);
  const [loading, set_loading] = useState(true);
  const [refreshing, set_refreshing] = useState(false);
  const [loading_more, set_loading_more] = useState(false);
  const cursor_ref = useRef<string | null>(null);
  const has_more_ref = useRef(false);

  const load = useCallback(async (append = false) => {
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
      console.warn('[history] fetch failed:', err);
    } finally {
      set_loading(false);
      set_refreshing(false);
      set_loading_more(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const on_refresh = useCallback(() => {
    set_refreshing(true);
    cursor_ref.current = null;
    load();
  }, [load]);

  const on_end_reached = useCallback(() => {
    if (!has_more_ref.current || loading_more) return;
    set_loading_more(true);
    load(true);
  }, [load, loading_more]);

  const sections = group_by_section(entries);

  const render_item = ({ item }: { item: HistoryEntry }) => {
    const action = action_meta[item.action_taken || ''] || action_meta[item.intent || ''] || {
      label: item.action_taken || item.intent || '?',
      emoji: '⭐',
      color_key: 'accent' as const,
    };
    const badge_color = colors[action.color_key];
    const has_error = !!item.error;

    return (
      <Pressable
        style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
        onPress={item.entry_url ? () => Linking.openURL(item.entry_url!) : undefined}
        android_ripple={{ color: colors.accent + '20' }}
      >
        <View style={styles.item_row}>
          {/* action badge */}
          <View style={[styles.action_badge, { backgroundColor: badge_color + '18' }]}>
            <Text style={styles.action_emoji}>{action.emoji}</Text>
          </View>

          {/* content */}
          <View style={styles.item_content}>
            <View style={styles.item_header}>
              <Text style={[styles.action_label, { color: badge_color }]}>
                {action.label}
              </Text>
              <Text style={[styles.time, { color: colors.textSecondary }]}>
                {format_time(item.timestamp || item.created_time)}
              </Text>
            </View>

            {/* intent details */}
            <View style={styles.meta_row}>
              {item.confidence != null && (
                <Text style={[styles.meta_tag, { color: colors.textSecondary }]}>
                  {Math.round(item.confidence * 100)}%
                </Text>
              )}
              {item.priority && (
                <Text style={[
                  styles.meta_tag,
                  {
                    color: item.priority === 'high' ? colors.error
                      : item.priority === 'low' ? colors.textSecondary
                      : colors.accent,
                  },
                ]}>
                  {item.priority}
                </Text>
              )}
              {item.duration_ms != null && (
                <Text style={[styles.meta_tag, { color: colors.textSecondary }]}>
                  {item.duration_ms < 1000
                    ? `${item.duration_ms}ms`
                    : `${(item.duration_ms / 1000).toFixed(1)}s`}
                </Text>
              )}
              {item.platform && (
                <Text style={[styles.meta_tag, { color: colors.textSecondary }]}>
                  {item.platform === 'ios_shortcut' ? 'ios'
                    : item.platform === 'android_pwa' ? 'android'
                    : item.platform === 'expo' ? 'app'
                    : item.platform}
                </Text>
              )}
            </View>

            {/* error line */}
            {has_error && (
              <Text style={[styles.error_text, { color: colors.error }]} numberOfLines={1}>
                {item.error}
              </Text>
            )}
          </View>

          {/* link arrow if has entry_url */}
          {item.entry_url && (
            <SymbolView
              name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }}
              tintColor={colors.textSecondary}
              size={14}
            />
          )}
        </View>
      </Pressable>
    );
  };

  const render_section_header = ({ section }: { section: { title: string } }) => (
    <View style={[styles.section_header, { backgroundColor: colors.background }]}>
      <Text style={[styles.section_title, { color: colors.textSecondary }]}>
        {section.title}
      </Text>
    </View>
  );

  const render_footer = () => {
    if (!loading_more) return null;
    return (
      <View style={styles.footer_loader}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  };

  // loading state
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loading_text, { color: colors.textSecondary }]}>
          loading history...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={render_item}
        renderSectionHeader={render_section_header}
        contentContainerStyle={entries.length === 0 ? styles.empty_list : styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={on_refresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={on_end_reached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={render_footer}
        ListEmptyComponent={
          <View style={styles.empty_container}>
            <SymbolView
              name={{ ios: 'clock', android: 'history', web: 'history' }}
              tintColor={colors.textSecondary}
              size={48}
            />
            <Text style={[styles.empty_title, { color: colors.text }]}>
              no history yet
            </Text>
            <Text style={[styles.empty_desc, { color: colors.textSecondary }]}>
              voice commands will appear here after you speak them
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  list: { paddingBottom: 20 },
  empty_list: { flexGrow: 1 },

  // section headers
  section_header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  section_title: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // item card
  item: {
    marginHorizontal: 12,
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  item_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  action_badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action_emoji: {
    fontSize: 16,
  },
  item_content: {
    flex: 1,
    gap: 2,
  },
  item_header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  action_label: {
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
  },
  meta_row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  meta_tag: {
    fontSize: 11,
  },
  error_text: {
    fontSize: 12,
    marginTop: 2,
  },

  // footer / loading
  footer_loader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loading_text: {
    fontSize: 14,
  },

  // empty state
  empty_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  empty_title: {
    fontSize: 18,
    fontWeight: '600',
  },
  empty_desc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
