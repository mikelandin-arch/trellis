import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../lib/theme';
import { EmptyState } from '../../components/ui';

export default function RequestsScreen(): React.ReactNode {
  return (
    <View style={styles.container}>
      <EmptyState
        icon="document-text-outline"
        title="Requests"
        subtitle="Violations and ARC requests coming in Phase 2"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
});
