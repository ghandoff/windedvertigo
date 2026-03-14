import { StyleSheet, View, Text, Pressable, Linking } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { HistoryEntry } from '@/src/api/history';

interface ChatBubbleProps {
  entry: HistoryEntry;
  colors: {
    text: string;
    textSecondary: string;
    surface: string;
    surfaceBorder: string;
    accent: string;
    success: string;
    error: string;
    background: string;
  };
}

// code pipeline actions that get special "system message" treatment
const system_actions = new Set([
  'code_conversation', 'code_approve', 'code_revise', 'code_status',
]);

const action_labels: Record<string, string> = {
  notion_note: 'note captured',
  notion_idea: 'idea captured',
  notion_task: 'task assigned',
  slack_check: 'slack checked',
  slack_message: 'message sent',
  slack_reply: 'reply sent',
  code_conversation: 'code task created',
  code_approve: 'plan approved',
  code_revise: 'plan revision sent',
  code_status: 'code status',
  build_approval: 'build approved',
  clarification_needed: 'clarification',
  exit: 'goodbye',
  error: 'error',
};

function format_time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ChatBubble({ entry, colors }: ChatBubbleProps) {
  const time = format_time(entry.timestamp || entry.created_time);
  const has_content = !!entry.content;
  const has_response = !!entry.spoken_response;
  const is_code_action = system_actions.has(entry.action_taken || '');
  const action_label = action_labels[entry.action_taken || ''] || entry.action_taken;

  // legacy entries without chat data — show as compact system-style row
  if (!has_content && !has_response) {
    return (
      <Animated.View entering={FadeIn.duration(150)} style={styles.system_row}>
        <View style={[styles.system_pill, { backgroundColor: colors.surface }]}>
          <Text style={[styles.system_text, { color: colors.textSecondary }]}>
            {action_label || entry.intent || 'interaction'} · {time}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.pair}>
      {/* code task thread indicator */}
      {is_code_action && (
        <View style={styles.thread_indicator}>
          <View style={[styles.thread_dot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.thread_label, { color: colors.accent }]}>
            {action_label}
          </Text>
        </View>
      )}

      {/* user bubble (right) */}
      {has_content && (
        <View style={styles.user_row}>
          <View style={[styles.bubble_user, { backgroundColor: colors.accent }]}>
            <Text style={[styles.bubble_text, { color: '#ffffff' }]}>
              {entry.content}
            </Text>
          </View>
          <Text style={[styles.time_text, { color: colors.textSecondary }, styles.time_right]}>
            {time}
          </Text>
        </View>
      )}

      {/* ai bubble (left) */}
      {has_response && (
        <View style={styles.ai_row}>
          <View style={[styles.bubble_ai, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.bubble_text, { color: colors.text }]}>
              {entry.spoken_response}
            </Text>
            {entry.entry_url && (
              <Pressable onPress={() => Linking.openURL(entry.entry_url!)}>
                <Text style={[styles.link_text, { color: colors.accent }]}>
                  open in notion
                </Text>
              </Pressable>
            )}
          </View>
          {!has_content && (
            <Text style={[styles.time_text, { color: colors.textSecondary }, styles.time_left]}>
              {time}
            </Text>
          )}
        </View>
      )}

      {/* error */}
      {entry.error && (
        <View style={styles.ai_row}>
          <View style={[styles.bubble_ai, { backgroundColor: colors.error + '15', borderColor: colors.error + '30' }]}>
            <Text style={[styles.bubble_text, { color: colors.error }]}>
              {entry.error}
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

export function DateSeparator({ label, colors }: { label: string; colors: { textSecondary: string } }) {
  return (
    <View style={styles.date_separator}>
      <Text style={[styles.date_text, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: {
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 4,
  },

  // user bubble — right aligned
  user_row: {
    alignItems: 'flex-end',
  },
  bubble_user: {
    maxWidth: '80%',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // ai bubble — left aligned
  ai_row: {
    alignItems: 'flex-start',
  },
  bubble_ai: {
    maxWidth: '80%',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  bubble_text: {
    fontSize: 15,
    lineHeight: 22,
  },

  link_text: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },

  time_text: {
    fontSize: 11,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  time_right: {
    textAlign: 'right',
  },
  time_left: {
    textAlign: 'left',
  },

  // thread indicator for code tasks
  thread_indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    marginBottom: 2,
  },
  thread_dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  thread_label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'lowercase',
  },

  // system/legacy rows
  system_row: {
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  system_pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  system_text: {
    fontSize: 12,
  },

  // date separator
  date_separator: {
    alignItems: 'center',
    marginVertical: 12,
  },
  date_text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
