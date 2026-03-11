import { StyleSheet, View, Text, Pressable, Linking } from 'react-native';
import type { VoiceResponse } from '@/src/api/voice';

interface ResponseCardProps {
  response: VoiceResponse;
  colors: {
    surface: string;
    surfaceBorder: string;
    text: string;
    textSecondary: string;
    success: string;
    error: string;
    accent: string;
  };
}

const action_labels: Record<string, { label: string; emoji: string; color_key: 'success' | 'error' | 'accent' }> = {
  notion_note: { label: 'note captured', emoji: '\u{1F4DD}', color_key: 'success' },
  notion_idea: { label: 'idea captured', emoji: '\u{1F4A1}', color_key: 'success' },
  notion_task: { label: 'task assigned', emoji: '\u2705', color_key: 'success' },
  slack_check: { label: 'slack checked', emoji: '\u{1F4AC}', color_key: 'accent' },
  slack_message: { label: 'message sent', emoji: '\u{1F4E8}', color_key: 'success' },
  slack_reply: { label: 'reply sent', emoji: '\u21A9\uFE0F', color_key: 'success' },
  code_conversation: { label: 'code started', emoji: '\u{1F4BB}', color_key: 'accent' },
  build_approval: { label: 'build approved', emoji: '\u{1F528}', color_key: 'success' },
  clarification_needed: { label: 'clarification', emoji: '\u2753', color_key: 'accent' },
  exit: { label: 'goodbye', emoji: '\u{1F44B}', color_key: 'accent' },
  error: { label: 'error', emoji: '\u26A0\uFE0F', color_key: 'error' },
};

export function ResponseCard({ response, colors }: ResponseCardProps) {
  const action = action_labels[response.action_taken] || {
    label: response.action_taken,
    emoji: '\u2B50',
    color_key: 'accent' as const,
  };

  const badge_color = colors[action.color_key];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      {/* action badge */}
      <View style={[styles.badge, { backgroundColor: badge_color + '20' }]}>
        <Text style={styles.badge_emoji}>{action.emoji}</Text>
        <Text style={[styles.badge_text, { color: badge_color }]}>
          {action.label}
        </Text>
      </View>

      {/* spoken response */}
      <Text style={[styles.response_text, { color: colors.text }]}>
        {response.spoken_response}
      </Text>

      {/* link to notion entry if available */}
      {response.entry_url && (
        <Pressable
          onPress={() => Linking.openURL(response.entry_url!)}
          style={styles.link}
        >
          <Text style={[styles.link_text, { color: colors.accent }]}>
            open in notion
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    marginBottom: 10,
  },
  badge_emoji: {
    fontSize: 12,
  },
  badge_text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  response_text: {
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    marginTop: 10,
  },
  link_text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
