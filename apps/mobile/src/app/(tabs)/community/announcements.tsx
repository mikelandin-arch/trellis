import { useCallback } from 'react';
import {
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing } from '../../../lib/theme';
import { Text, Card, Badge, EmptyState, LoadingSkeleton } from '../../../components/ui';
import {
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABELS,
} from '@repo/shared';
import type { CommunicationPriority } from '@repo/shared';

export default function AnnouncementsScreen(): React.ReactNode {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useQuery(
    trpc.communication.list.queryOptions({
      communicationType: ['announcement'],
      limit: 50,
    }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.communication.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const announcements = query.data?.items ?? [];

  if (query.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} width="100%" height={80} borderRadius={12} style={styles.skeletonItem} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={announcements}
        keyExtractor={(item) => item.id}
        estimatedItemSize={80}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.base}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/community/announcement/${item.id}`)}
            accessibilityLabel={`Announcement: ${item.subject}`}
          >
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text variant="bodyBold" style={styles.title} numberOfLines={2}>
                  {item.subject}
                </Text>
                <Badge
                  variant={PRIORITY_BADGE_VARIANT[item.priority as CommunicationPriority]}
                  label={PRIORITY_LABELS[item.priority as CommunicationPriority]}
                />
              </View>
              <Text variant="caption" color={colors.neutral.textTertiary}>
                {item.sentAt
                  ? new Date(item.sentAt).toLocaleDateString()
                  : 'Draft'}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="megaphone-outline"
            title="No announcements"
            subtitle="Community announcements will appear here"
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  title: {
    flex: 1,
    marginRight: spacing.sm,
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  skeletonItem: {
    marginBottom: spacing.sm,
  },
});
