import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../../lib/theme';
import { Text } from './text';

type CardProps = ViewProps & {
  readonly header?: string;
  readonly padded?: boolean;
};

export function Card({
  header,
  padded = true,
  style,
  children,
  ...props
}: CardProps): React.ReactNode {
  return (
    <View style={[styles.container, padded && styles.padded, style]} {...props}>
      {header != null && (
        <Text variant="heading3" style={styles.header}>
          {header}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    ...shadows.sm,
  },
  padded: {
    padding: spacing.lg,
  },
  header: {
    fontSize: typography.heading3.fontSize,
    fontWeight: typography.heading3.fontWeight,
    marginBottom: spacing.md,
  },
});
