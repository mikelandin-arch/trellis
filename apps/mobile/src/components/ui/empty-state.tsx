import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../lib/theme';
import { Text } from './text';
import { Button } from './button';

type EmptyStateProps = {
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly title: string;
  readonly subtitle?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
};

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps): React.ReactNode {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={48} color={colors.neutral.textTertiary} />
      </View>
      <Text variant="heading3" align="center" color={colors.neutral.textSecondary}>
        {title}
      </Text>
      {subtitle != null && (
        <Text variant="caption" align="center" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      {actionLabel != null && onAction != null && (
        <View style={styles.action}>
          <Button
            label={actionLabel}
            onPress={onAction}
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.xl,
    width: '100%',
  },
});
