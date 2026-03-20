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
  MEETING_STATUS_LABELS,
  MEETING_STATUS_BADGE_VARIANT,
  MEETING_TYPE_LABELS,
} from '@repo/shared';
import type { MeetingStatus, MeetingType } from '@repo/shared';

type Tab = 'upcoming' | 'past';

export default function MeetingsScreen(): React.ReactNode {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('upcoming');

  const now = new Date();
  const query = useQuery(
    trpc.meeting.list.queryOptions(
      tab === 'upcoming'
        ? { dateFrom: now, limit: 50 }
        : { dateTo: now, limit: 50 },
    ),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.meeting.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const meetings = query.data?.items ?? [];

  if (query.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, styles.activeTab]}>
            <Text variant="bodyBold" color={colors.primary.base}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Text variant="body" color={colors.neutral.textTertiary}>Past</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} width="100%" height={100} borderRadius={12} style={styles.skeletonItem} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'upcoming' && styles.activeTab]}
          onPress={() => setTab('upcoming')}
          accessibilityLabel="Show upcoming meetings"
        >
          <Text
            variant={tab === 'upcoming' ? 'bodyBold' : 'body'}
            color={tab === 'upcoming' ? colors.primary.base : colors.neutral.textTertiary}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'past' && styles.activeTab]}
          onPress={() => setTab('past')}
          accessibilityLabel="Show past meetings"
        >
          <Text
            variant={tab === 'past' ? 'bodyBold' : 'body'}
            color={tab === 'past' ? colors.primary.base : colors.neutral.textTertiary}
          >
            Past
          </Text>
        </TouchableOpacity>
      </View>

      <FlashList
        data={meetings}
        keyExtractor={(item) => item.id}
        estimatedItemSize={100}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.base}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/admin/meetings/${item.id}`)}
            accessibilityLabel={`Meeting: ${item.title}`}
          >
            <Card style={styles.meetingCard}>
              <View style={styles.meetingHeader}>
                <Text variant="bodyBold" style={styles.meetingTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Badge
                  variant={MEETING_STATUS_BADGE_VARIANT[item.status as MeetingStatus]}
                  label={MEETING_STATUS_LABELS[item.status as MeetingStatus]}
                />
              </View>
              <View style={styles.meetingMeta}>
                <Badge
                  variant="neutral"
                  label={MEETING_TYPE_LABELS[item.meetingType as MeetingType]}
                />
                <Text variant="caption" color={colors.neutral.textTertiary}>
                  {new Date(item.scheduledAt).toLocaleDateString()} at{' '}
                  {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {item.location ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.neutral.textTertiary} />
                  <Text variant="caption" color={colors.neutral.textTertiary} style={styles.locationText}>
                    {item.location}
                  </Text>
                </View>
              ) : null}
              {item.quorumMet !== null && (
                <View style={styles.quorumRow}>
                  <Ionicons
                    name={item.quorumMet ? 'checkmark-circle' : 'close-circle'}
                    size={14}
                    color={item.quorumMet ? colors.success.base : colors.warning.base}
                  />
                  <Text variant="caption" color={colors.neutral.textSecondary} style={styles.quorumText}>
                    Quorum: {item.quorumPresent ?? 0}/{item.quorumRequired ?? '?'}
                  </Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title={tab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
            subtitle={tab === 'upcoming' ? 'Schedule a meeting to get started' : 'Past meetings will appear here'}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/admin/meetings/new')}
        accessibilityLabel="Schedule meeting"
      >
        <Ionicons name="add" size={28} color="#fff" />
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
  meetingCard: {
    marginBottom: spacing.sm,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  meetingTitle: {
    flex: 1,
    marginRight: spacing.sm,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  locationText: {
    marginLeft: spacing.xs,
  },
  quorumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  quorumText: {
    marginLeft: spacing.xs,
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
