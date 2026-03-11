// pocket.prompts dark-first color palette
// matches the PWA and setup page aesthetics

const accent = '#6366f1'; // indigo-500
const accentLight = '#818cf8'; // indigo-400
const success = '#22c55e'; // green-500
const error = '#ef4444'; // red-500
const warning = '#f59e0b'; // amber-500

export default {
  light: {
    text: '#1a1a2e',
    textSecondary: '#64748b',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceBorder: '#e2e8f0',
    tint: accent,
    accent,
    accentLight,
    success,
    error,
    warning,
    tabIconDefault: '#94a3b8',
    tabIconSelected: accent,
    micButton: accent,
    micButtonActive: error,
  },
  dark: {
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    background: '#0a0a0a',
    surface: '#1a1a2e',
    surfaceBorder: '#2d2d44',
    tint: accentLight,
    accent: accentLight,
    accentLight,
    success,
    error,
    warning,
    tabIconDefault: '#64748b',
    tabIconSelected: accentLight,
    micButton: accentLight,
    micButtonActive: error,
  },
} as const;

export type ColorScheme = 'light' | 'dark';
