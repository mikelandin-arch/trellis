import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  primary: {
    dark: '#1e40af',
    base: '#2563eb',
    light: '#3b82f6',
    surface: '#dbeafe',
  },
  success: {
    dark: '#15803d',
    base: '#16a34a',
    surface: '#dcfce7',
  },
  warning: {
    dark: '#b45309',
    base: '#d97706',
    surface: '#fef3c7',
  },
  error: {
    dark: '#b91c1c',
    base: '#dc2626',
    surface: '#fee2e2',
  },
  neutral: {
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    border: '#e2e8f0',
    surface: '#f1f5f9',
    background: '#ffffff',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const typography = {
  heading1: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
    lineHeight: 34,
  } satisfies TextStyle,
  heading2: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.neutral.textPrimary,
    lineHeight: 30,
  } satisfies TextStyle,
  heading3: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.neutral.textPrimary,
    lineHeight: 26,
  } satisfies TextStyle,
  body: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.neutral.textPrimary,
    lineHeight: 26,
  } satisfies TextStyle,
  bodyBold: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.textPrimary,
    lineHeight: 26,
  } satisfies TextStyle,
  caption: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.neutral.textSecondary,
    lineHeight: 22,
  } satisfies TextStyle,
  small: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.neutral.textTertiary,
    lineHeight: 20,
  } satisfies TextStyle,
} as const;

export const shadows = {
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 1,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
  }) ?? {},
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
  }) ?? {},
  lg: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {
      elevation: 6,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
  }) ?? {},
} as const;
