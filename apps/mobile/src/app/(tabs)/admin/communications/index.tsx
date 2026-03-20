import { useCallback, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing } from '../../../../lib/theme';
import { Text, Card, Badge, EmptyState, LoadingSkeleton } from '../../../../components/ui';
import {
  COMMUNICATION_STATUS_LABELS,
  COMMUNICATION_STATUS_BADGE_VARIANT,
  COMMUNICATION_TYPE_LABELS,
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABELS,
} from '@repo/shared';
import type { CommunicationStatus, CommunicationType, CommunicationPriority } from '@repo/shared';

type Tab = 'sent' | 'draft';

export default function CommunicationsScreen(): React.ReactNode {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('sent');

  const query = useQuery(
    trpc.communication.list.queryOptions({
      status: tab === 'sent' ? ['sent', 'sending'] : ['draft', 'scheduled'],
      limit: 50,
    }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.communication.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const items = query.data?.items ?? [];

  if (query.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, styles.activeTab]}>
            <Text variant="bodyBold" color={colors.primary.base}>Sent</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text variant="body" color={colors.neutral.textTertiary}>Drafts</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} width="100%" height={80} borderRadius={12} style={styles.skeletonItem} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'sent' && styles.activeTab]}
          onPress={() => setTab('sent')}
          accessibilityLabel="Show sent communications"
        >
          <Text
            variant={tab === 'sent' ? 'bodyBold' : 'body'}
            color={tab === 'sent' ? colors.primary.base : colors.neutral.textTertiary}
          >
            Sent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'draft' && styles.activeTab]}
          onPress={() => setTab('draft')}
          accessibilityLabel="Show draft communications"
        >
          <Text
            variant={tab === 'draft' ? 'bodyBold' : 'body'}
            color={tab === 'draft' ? colors.primary.base : colors.neutral.textTertiary}
          >
            Drafts
          </Text>
        </TouchableOpacity>
      </View>

      <FlashList
        data={items}
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
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text variant="bodyBold" style={styles.cardTitle} numberOfLines={1}>
                {item.subject}
              </Text>
              <Badge
                variant={COMMUNICATION_STATUS_BADGE_VARIANT[item.status as CommunicationStatus]}
                label={COMMUNICATION_STATUS_LABELS[item.status as CommunicationStatus]}
              />
            </View>
            <View style={styles.cardMeta}>
              <Badge
                variant="neutral"
                label={COMMUNICATION_TYPE_LABELS[item.communicationType as CommunicationType]}
              />
              <Badge
                variant={PRIORITY_BADGE_VARIANT[item.priority as CommunicationPriority]}
                label={PRIORITY_LABELS[item.priority as CommunicationPriority]}
              />
              <Text variant="caption" color={colors.neutral.textTertiary}>
                {item.sentAt
                  ? new Date(item.sentAt).toLocaleDateString()
                  : new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="mail-outline"
            title={tab === 'sent' ? 'No sent communications' : 'No drafts'}
            subtitle={tab === 'sent' ? 'Sent communications will appear here' : 'Draft communications will appear here'}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/admin/communications/compose')}
        accessibilityLabel="Compose communication"
      >
        <Ionicons name="create" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary.base,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 80,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.base,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  skeletonItem: {
    marginBottom: spacing.sm,
  },
});
