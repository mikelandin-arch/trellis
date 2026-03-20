import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '../../../lib/clerk';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing, borderRadius, shadows } from '../../../lib/theme';
import {
  Text, Card, Badge, EmptyState, LoadingSkeleton,
} from '../../../components/ui';
import {
  ARC_STATUS, ARC_STATUS_LABELS, ARC_STATUS_BADGE_VARIANT,
  TERMINAL_ARC_STATES, CLERK_ROLES, COMPLEXITY_TIER_LABELS,
} from '@repo/shared';
import type { ArcStatus } from '@repo/shared';

type StatusFilter = ArcStatus | 'all';

const BOARD_ROLES: ReadonlySet<string> = new Set([
  CLERK_ROLES.SUPER_ADMIN,
  CLERK_ROLES.BOARD_OFFICER,
  CLERK_ROLES.BOARD_MEMBER,
  CLERK_ROLES.PROPERTY_MANAGER,
  CLERK_ROLES.COMMITTEE_MEMBER,
]);

const STATUS_CHIPS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Submitted', value: ARC_STATUS.SUBMITTED },
  { label: 'Under Review', value: ARC_STATUS.UNDER_REVIEW },
  { label: 'Committee', value: ARC_STATUS.COMMITTEE_REVIEW },
  { label: 'Approved', value: ARC_STATUS.APPROVED },
  { label: 'Conditional', value: ARC_STATUS.APPROVED_WITH_CONDITIONS },
  { label: 'Denied', value: ARC_STATUS.DENIED },
  { label: 'Active', value: ARC_STATUS.CONSTRUCTION_ACTIVE },
  { label: 'Completed', value: ARC_STATUS.COMPLETED },
];

export default function RequestsListScreen(): React.ReactNode {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { membership } = useOrganization();
  const role = membership?.role;
  const isBoard = role != null && BOARD_ROLES.has(role);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  const queryInput = useMemo(() => ({
    limit: 50,
    ...(activeFilter !== 'all' ? { status: [activeFilter] } : {}),
  }), [activeFilter]);

  const requestQuery = useQuery(
    trpc.arcRequest.list.queryOptions(queryInput),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.arcRequest.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const requests = requestQuery.data?.items ?? [];
  const isLoading = requestQuery.isLoading;

  const pendingReviewCount = useMemo(() => {
    if (!isBoard) return 0;
    return requests.filter((r) =>
      r.status === ARC_STATUS.SUBMITTED ||
      r.status === ARC_STATUS.UNDER_REVIEW ||
      r.status === ARC_STATUS.COMMITTEE_REVIEW
    ).length;
  }, [requests, isBoard]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="heading2">
          {isBoard ? 'All Requests' : 'My Requests'}
        </Text>
        {isBoard && pendingReviewCount > 0 ? (
          <Badge variant="warning" label={`${pendingReviewCount} pending`} />
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_CHIPS.map((chip) => (
          <Pressable
            key={chip.value}
            onPress={() => setActiveFilter(chip.value)}
            style={[
              styles.chip,
              activeFilter === chip.value && styles.chipActive,
            ]}
            accessibilityLabel={`Filter by ${chip.label}`}
            accessibilityRole="button"
          >
            <Text
              variant="small"
              color={activeFilter === chip.value ? colors.neutral.background : colors.neutral.textSecondary}
              style={styles.chipText}
            >
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} style={styles.listCard}>
              <LoadingSkeleton width="70%" height={20} borderRadius={6} />
              <LoadingSkeleton width="50%" height={16} borderRadius={4} />
            </Card>
          ))}
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="document-text-outline"
            title="No requests found"
            subtitle={activeFilter !== 'all'
              ? 'Try a different filter'
              : isBoard
                ? 'ARC requests from homeowners will appear here'
                : 'Submit your first modification request'}
          />
        </View>
      ) : (
        <FlashList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ArcRequestCard
              item={item}
              isBoard={isBoard}
              onPress={() => router.push(`/requests/${item.id}`)}
            />
          )}
          ItemSeparatorComponent={Separator}
          refreshControl={
            <RefreshControl
              refreshing={requestQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary.base}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/requests/new')}
        accessibilityLabel="Submit a new ARC request"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={colors.neutral.background} />
      </Pressable>
    </View>
  );
}

function ArcRequestCard({
  item,
  isBoard,
  onPress,
}: {
  readonly item: {
    id: string;
    title: string;
    status: string;
    complexityTier: number;
    propertyAddress: string | null;
    propertyLot: string | null;
    applicantFirstName: string | null;
    applicantLastName: string | null;
    modificationTypeName: string | null;
    reviewDeadline: string | null;
    deemedApprovedDeadline: string | null;
    daysRemainingReview: number | null;
    daysRemainingDeemedApproved: number | null;
    submissionDate: string | null;
  };
  readonly isBoard: boolean;
  readonly onPress: () => void;
}): React.ReactNode {
  const isTerminal = TERMINAL_ARC_STATES.includes(item.status as ArcStatus);
  const daysRemaining = item.daysRemainingReview;

  const deadlineColor = daysRemaining != null && daysRemaining < 0
    ? colors.error.base
    : daysRemaining != null && daysRemaining <= 3
      ? colors.error.base
      : daysRemaining != null && daysRemaining <= 7
        ? colors.warning.base
        : null;

  return (
    <Pressable onPress={onPress} accessibilityLabel={`View request: ${item.title}`}>
      <Card style={styles.listCard}>
        <View style={styles.cardHeader}>
          <Badge
            variant={ARC_STATUS_BADGE_VARIANT[item.status as ArcStatus] ?? 'neutral'}
            label={ARC_STATUS_LABELS[item.status as ArcStatus] ?? item.status}
          />
          {item.modificationTypeName ? (
            <Text variant="small" color={colors.neutral.textTertiary}>
              {COMPLEXITY_TIER_LABELS[item.complexityTier] ?? 'Standard'}
            </Text>
          ) : null}
        </View>
        <Text variant="bodyBold" numberOfLines={1} style={styles.cardTitle}>
          {item.title}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {item.propertyAddress ?? (item.propertyLot ? `Lot ${item.propertyLot}` : 'Unknown')}
          {isBoard && item.applicantFirstName
            ? ` — ${item.applicantFirstName} ${item.applicantLastName ?? ''}`
            : ''}
        </Text>
        <View style={styles.cardFooter}>
          {item.submissionDate ? (
            <Text variant="small">
              Submitted {item.submissionDate}
            </Text>
          ) : null}
          {!isTerminal && daysRemaining != null && deadlineColor ? (
            <View style={styles.deadlineRow}>
              <Ionicons name="time-outline" size={14} color={deadlineColor} />
              <Text variant="small" color={deadlineColor} style={styles.deadlineText}>
                {daysRemaining < 0
                  ? `${Math.abs(daysRemaining)}d overdue`
                  : daysRemaining === 0
                    ? 'Due today'
                    : `${daysRemaining}d left`}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function Separator(): React.ReactNode {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.neutral.background,
  },
  filterBar: {
    maxHeight: 56,
    backgroundColor: colors.neutral.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.surface,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary.base,
  },
  chipText: {
    fontWeight: '600',
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  listCard: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    marginBottom: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineText: {
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  separator: {
    height: spacing.xs,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.base,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});
