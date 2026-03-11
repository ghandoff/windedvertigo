import { Platform } from 'react-native';

// remote-command is iOS-only. on android/web, every call is a safe no-op.

type RemoteCommandModule = {
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  addListener(event: string, handler: (data: any) => void): { remove(): void };
};

const stub: RemoteCommandModule = {
  enable: () => {},
  disable: () => {},
  isEnabled: () => false,
  addListener: () => ({ remove: () => {} }),
};

let mod: RemoteCommandModule;

if (Platform.OS === 'ios') {
  try {
    // expo autolinking registers the native module at build time
    const { requireNativeModule } = require('expo-modules-core');
    mod = requireNativeModule('RemoteCommand');
  } catch {
    console.warn('[remote-command] native module not available — using stub');
    mod = stub;
  }
} else {
  mod = stub;
}

export default mod;
