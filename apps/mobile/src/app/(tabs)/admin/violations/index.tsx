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
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing, borderRadius, shadows } from '../../../../lib/theme';
import {
  Text, Card, Badge, EmptyState, LoadingSkeleton,
} from '../../../../components/ui';
import {
  VIOLATION_STATUS, VIOLATION_STATUS_LABELS,
  STATUS_BADGE_VARIANT, SEVERITY_BADGE_VARIANT,
  VIOLATION_SEVERITY_LABELS, TERMINAL_STATES,
} from '@repo/shared';
import type { ViolationStatus } from '@repo/shared';

type StatusFilter = ViolationStatus | 'all';

const STATUS_CHIPS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: VIOLATION_STATUS.REPORTED },
  { label: 'Verified', value: VIOLATION_STATUS.VERIFIED },
  { label: 'Courtesy Sent', value: VIOLATION_STATUS.COURTESY_NOTICE_SENT },
  { label: 'Formal Sent', value: VIOLATION_STATUS.FORMAL_NOTICE_SENT },
  { label: 'Hearing', value: VIOLATION_STATUS.HEARING_SCHEDULED },
  { label: 'Fine', value: VIOLATION_STATUS.FINE_ASSESSED },
  { label: 'Resolved', value: VIOLATION_STATUS.RESOLVED_CURED },
  { label: 'Dismissed', value: VIOLATION_STATUS.DISMISSED },
];

export default function ViolationsListScreen(): React.ReactNode {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  const queryInput = useMemo(() => ({
    limit: 50,
    ...(activeFilter !== 'all' ? { status: [activeFilter] } : {}),
  }), [activeFilter]);

  const violationQuery = useQuery(
    trpc.violation.list.queryOptions(queryInput),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.violation.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const violations = violationQuery.data?.items ?? [];
  const isLoading = violationQuery.isLoading;

  return (
    <View style={styles.container}>
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
      ) : violations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="shield-outline"
            title="No violations found"
            subtitle={activeFilter !== 'all'
              ? 'Try a different filter'
              : 'Violations you report will appear here'}
          />
        </View>
      ) : (
        <FlashList
          data={violations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ViolationCard item={item} onPress={() => router.push(`/admin/violations/${item.id}`)} />}
          ItemSeparatorComponent={Separator}
          refreshControl={
            <RefreshControl
              refreshing={violationQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary.base}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/admin/violations/report')}
        accessibilityLabel="Report a new violation"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={colors.neutral.background} />
      </Pressable>
    </View>
  );
}

function ViolationCard({
  item,
  onPress,
}: {
  readonly item: {
    id: string;
    title: string;
    status: string;
    severity: string;
    reportedDate: string;
    cureDeadline: string | null;
    propertyAddress: string | null;
    propertyLot: string | null;
    categoryName: string | null;
  };
  readonly onPress: () => void;
}): React.ReactNode {
  const isOverdue = item.cureDeadline
    && item.cureDeadline < new Date().toISOString().split('T')[0]!
    && !TERMINAL_STATES.includes(item.status as ViolationStatus);

  return (
    <Pressable onPress={onPress} accessibilityLabel={`View violation: ${item.title}`}>
      <Card style={styles.listCard}>
        <View style={styles.cardHeader}>
          <Badge
            variant={STATUS_BADGE_VARIANT[item.status as ViolationStatus] ?? 'neutral'}
            label={VIOLATION_STATUS_LABELS[item.status as ViolationStatus] ?? item.status}
          />
          <Badge
            variant={SEVERITY_BADGE_VARIANT[item.severity] ?? 'neutral'}
            label={VIOLATION_SEVERITY_LABELS[item.severity as keyof typeof VIOLATION_SEVERITY_LABELS] ?? item.severity}
          />
        </View>
        <Text variant="bodyBold" numberOfLines={1} style={styles.cardTitle}>
          {item.title}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {item.propertyAddress ?? (item.propertyLot ? `Lot ${item.propertyLot}` : 'Unknown')}
        </Text>
        <View style={styles.cardFooter}>
          <Text variant="small">
            Reported {item.reportedDate}
          </Text>
          {isOverdue ? (
            <Text variant="small" color={colors.error.base} style={styles.overdueText}>
              Overdue
            </Text>
          ) : null}
          {item.cureDeadline && !isOverdue && !TERMINAL_STATES.includes(item.status as ViolationStatus) ? (
            <Text variant="small" color={colors.warning.base}>
              Due {item.cureDeadline}
            </Text>
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
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    marginBottom: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  overdueText: {
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
