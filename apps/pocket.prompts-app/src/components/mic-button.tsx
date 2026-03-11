import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface MicButtonProps {
  is_listening: boolean;
  is_processing: boolean;
  on_press: () => void;
  color_active: string;
  color_idle: string;
}

const BUTTON_SIZE = 88;

export function MicButton({
  is_listening,
  is_processing,
  on_press,
  color_active,
  color_idle,
}: MicButtonProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (is_listening) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1, // infinite
        true
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [is_listening, pulse]);

  const ring_style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: is_listening ? 0.3 : 0,
  }));

  const handle_press = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    on_press();
  };

  const bg = is_listening ? color_active : color_idle;
  const icon_name = is_listening
    ? 'stop.fill'
    : is_processing
    ? 'ellipsis'
    : 'mic.fill';

  return (
    <View style={styles.container}>
      {/* pulsing ring behind button */}
      <Animated.View
        style={[
          styles.ring,
          { backgroundColor: color_active },
          ring_style,
        ]}
      />

      <Pressable
        onPress={handle_press}
        disabled={is_processing}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: bg, opacity: pressed ? 0.8 : is_processing ? 0.5 : 1 },
        ]}
      >
        <SymbolView
          name={{ ios: icon_name, android: 'mic', web: 'mic' }}
          tintColor="#ffffff"
          size={36}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: BUTTON_SIZE + 24,
    height: BUTTON_SIZE + 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: BUTTON_SIZE + 24,
    height: BUTTON_SIZE + 24,
    borderRadius: (BUTTON_SIZE + 24) / 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
