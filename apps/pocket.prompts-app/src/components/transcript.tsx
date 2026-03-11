import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface TranscriptProps {
  text: string;
  is_listening: boolean;
  colors: {
    text: string;
    textSecondary: string;
  };
}

export function Transcript({ text, is_listening, colors }: TranscriptProps) {
  if (!text && !is_listening) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      {text ? (
        <Text style={[styles.text, { color: colors.text }]}>
          {text}
        </Text>
      ) : is_listening ? (
        <Text style={[styles.placeholder, { color: colors.textSecondary }]}>
          listening...
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  text: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
  },
  placeholder: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
