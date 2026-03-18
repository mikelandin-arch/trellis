import { StyleSheet, View } from 'react-native';
import { colors, spacing, borderRadius } from '../../lib/theme';
import { Text } from './text';

type BadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';

type BadgeProps = {
  readonly variant?: BadgeVariant;
  readonly label: string;
};

const VARIANT_COLORS = {
  info: { bg: colors.primary.surface, text: colors.primary.dark },
  success: { bg: colors.success.surface, text: colors.success.dark },
  warning: { bg: colors.warning.surface, text: colors.warning.dark },
  error: { bg: colors.error.surface, text: colors.error.dark },
  neutral: { bg: colors.neutral.surface, text: colors.neutral.textSecondary },
} as const;

export function Badge({
  variant = 'neutral',
  label,
}: BadgeProps): React.ReactNode {
  const variantColor = VARIANT_COLORS[variant];

  return (
    <View style={[styles.container, { backgroundColor: variantColor.bg }]}>
      <Text variant="small" color={variantColor.text} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    lineHeight: 18,
  },
});
