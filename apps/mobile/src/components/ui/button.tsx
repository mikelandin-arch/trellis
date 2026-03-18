import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

export type ButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly icon?: React.ComponentProps<typeof Ionicons>['name'];
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
};

const VARIANT_STYLES = {
  primary: {
    container: {
      backgroundColor: colors.primary.base,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    text: { color: '#ffffff' },
    spinnerColor: '#ffffff',
  },
  secondary: {
    container: {
      backgroundColor: colors.primary.surface,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    text: { color: colors.primary.dark },
    spinnerColor: colors.primary.dark,
  },
  outline: {
    container: {
      backgroundColor: colors.neutral.background,
      borderWidth: 1.5,
      borderColor: colors.neutral.border,
    },
    text: { color: colors.neutral.textPrimary },
    spinnerColor: colors.neutral.textPrimary,
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    text: { color: colors.neutral.textSecondary },
    spinnerColor: colors.neutral.textSecondary,
  },
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps): React.ReactNode {
  const variantStyle = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        variantStyle.container,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.spinnerColor} size="small" />
      ) : (
        <View style={styles.content}>
          {icon != null && (
            <Ionicons
              name={icon}
              size={20}
              color={variantStyle.text.color}
              style={styles.icon}
            />
          )}
          <Text style={[styles.label, variantStyle.text]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  label: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    lineHeight: typography.body.lineHeight,
  },
});
