import { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing } from '../../../../lib/theme';
import { Text, Card, Badge, LoadingSkeleton } from '../../../../components/ui';
import {
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABELS,
  COMMUNICATION_TYPE_LABELS,
} from '@repo/shared';
import type { CommunicationPriority, CommunicationType } from '@repo/shared';

export default function AnnouncementDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(
    trpc.communication.getById.queryOptions({ id }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.communication.getById.queryKey({ id }),
    });
  }, [queryClient, trpc, id]);

  if (query.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSkeleton width="80%" height={28} borderRadius={4} />
          <LoadingSkeleton width="40%" height={18} borderRadius={4} style={styles.loadingGap} />
          <LoadingSkeleton width="100%" height={200} borderRadius={12} style={styles.loadingGap} />
        </View>
      </View>
    );
  }

  const comm = query.data;
  if (!comm) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary.base}
        />
      }
    >
      <View style={styles.titleRow}>
        <Text variant="heading2" style={styles.title}>{comm.subject}</Text>
      </View>

      <View style={styles.metaRow}>
        <Badge
          variant={PRIORITY_BADGE_VARIANT[comm.priority as CommunicationPriority]}
          label={PRIORITY_LABELS[comm.priority as CommunicationPriority]}
        />
        <Badge
          variant="info"
          label={COMMUNICATION_TYPE_LABELS[comm.communicationType as CommunicationType]}
        />
      </View>

      <Text variant="caption" color={colors.neutral.textTertiary} style={styles.date}>
        {comm.sentAt
          ? `Sent ${new Date(comm.sentAt).toLocaleDateString()} at ${new Date(comm.sentAt).toLocaleTimeString()}`
          : `Created ${new Date(comm.createdAt).toLocaleDateString()}`}
      </Text>

      <Card style={styles.bodyCard}>
        <Text variant="body">{comm.body}</Text>
      </Card>

      {comm.deliveryStats && Object.keys(comm.deliveryStats).length > 0 && (
        <Card style={styles.statsCard}>
          <Text variant="bodyBold" style={styles.statsTitle}>Delivery Status</Text>
          {Object.entries(comm.deliveryStats).map(([status, countVal]) => (
            <View key={status} style={styles.statRow}>
              <Text variant="body" style={styles.statLabel}>{status}</Text>
              <Text variant="bodyBold">{String(countVal)}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  titleRow: {
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  date: {
    marginBottom: spacing.lg,
  },
  bodyCard: {
    marginBottom: spacing.lg,
  },
  statsCard: {
    marginBottom: spacing.lg,
  },
  statsTitle: {
    marginBottom: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  statLabel: {
    textTransform: 'capitalize',
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  loadingGap: {
    marginTop: spacing.md,
  },
});
