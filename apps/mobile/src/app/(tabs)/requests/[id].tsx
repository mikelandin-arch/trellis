import { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useOrganization } from '../../../lib/clerk';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing } from '../../../lib/theme';
import {
  Text, Card, Badge, Button, LoadingSkeleton, EmptyState,
} from '../../../components/ui';
import {
  ARC_STATUS_LABELS, ARC_STATUS_BADGE_VARIANT,
  TERMINAL_ARC_STATES, ARC_STATUS, CLERK_ROLES,
  COMPLEXITY_TIER_LABELS,
} from '@repo/shared';
import type { ArcStatus } from '@repo/shared';

const BOARD_ROLES: ReadonlySet<string> = new Set([
  CLERK_ROLES.SUPER_ADMIN,
  CLERK_ROLES.BOARD_OFFICER,
  CLERK_ROLES.BOARD_MEMBER,
  CLERK_ROLES.PROPERTY_MANAGER,
  CLERK_ROLES.COMMITTEE_MEMBER,
]);

export default function RequestDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { membership } = useOrganization();
  const role = membership?.role;
  const isBoard = role != null && BOARD_ROLES.has(role);

  const detailQuery = useQuery(
    trpc.arcRequest.getById.queryOptions({ id: id! }),
  );

  const acceptMutation = useMutation(
    trpc.arcRequest.acceptConditions.mutationOptions(),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.arcRequest.getById.queryKey({ id: id! }),
    });
  }, [queryClient, trpc, id]);

  const handleAcceptConditions = useCallback(async () => {
    await acceptMutation.mutateAsync({ requestId: id! });
    void queryClient.invalidateQueries({
      queryKey: trpc.arcRequest.getById.queryKey({ id: id! }),
    });
  }, [acceptMutation, id, queryClient, trpc]);

  if (detailQuery.isLoading) {
    return <LoadingState />;
  }

  if (!detailQuery.data) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState icon="alert-circle-outline" title="Not found" subtitle="This request could not be loaded" />
      </View>
    );
  }

  const {
    request, transitions, votes, validTransitions,
    daysRemainingReview, daysRemainingDeemedApproved,
    deemedApproved, protectedModification,
  } = detailQuery.data;

  const status = request.status as ArcStatus;
  const isTerminal = TERMINAL_ARC_STATES.includes(status);
  const conditions = (request.conditions ?? []) as Array<{ condition: string; dueDate?: string | null }>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={detailQuery.isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary.base}
        />
      }
    >
      <StatusHeader
        status={status}
        daysRemainingReview={daysRemainingReview}
        reviewDeadline={request.reviewDeadline}
        isTerminal={isTerminal}
      />

      {deemedApproved.isDeemedApproved ? (
        <View style={styles.deemedBanner}>
          <Ionicons name="warning" size={20} color={colors.neutral.background} />
          <Text variant="bodyBold" color={colors.neutral.background} style={styles.bannerText}>
            DEEMED APPROVED — Deadline passed {deemedApproved.daysOverdue} day(s) ago without a decision.
            This modification is legally approved.
          </Text>
        </View>
      ) : daysRemainingDeemedApproved != null && daysRemainingDeemedApproved <= 3 && daysRemainingDeemedApproved > 0 && !isTerminal ? (
        <View style={styles.urgentBanner}>
          <Ionicons name="alert-circle" size={20} color={colors.neutral.background} />
          <Text variant="bodyBold" color={colors.neutral.background} style={styles.bannerText}>
            {daysRemainingDeemedApproved} day(s) until deemed-approved deadline.
            A decision must be made or this request is automatically approved.
          </Text>
        </View>
      ) : null}

      {protectedModification ? (
        <View style={styles.protectedBanner}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary.light} />
          <Text variant="small" color={colors.primary.light} style={styles.bannerText}>
            Protected modification ({protectedModification.law}). {protectedModification.restriction}
          </Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <Card style={styles.sectionCard}>
          <Text variant="heading3" style={styles.sectionTitle}>Request Details</Text>
          <Text variant="bodyBold">{request.title}</Text>
          <Text variant="body" style={styles.descText}>{request.description}</Text>
          <View style={styles.metaRow}>
            <MetaItem label="Type" value={request.modificationTypeName ?? 'Unknown'} />
            <MetaItem label="Tier" value={COMPLEXITY_TIER_LABELS[request.complexityTier] ?? 'Standard'} />
            {request.estimatedCost ? (
              <MetaItem label="Est. Cost" value={`$${Number(request.estimatedCost).toLocaleString()}`} />
            ) : null}
            {request.estimatedStartDate ? (
              <MetaItem label="Start Date" value={request.estimatedStartDate} />
            ) : null}
            {request.estimatedCompletionDate ? (
              <MetaItem label="Completion" value={request.estimatedCompletionDate} />
            ) : null}
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text variant="heading3" style={styles.sectionTitle}>Property</Text>
          <Text variant="bodyBold">{request.propertyAddress ?? 'Unknown address'}</Text>
          {request.propertyLot ? (
            <Text variant="caption">Lot {request.propertyLot}</Text>
          ) : null}
          {request.propertyCity ? (
            <Text variant="caption">
              {[request.propertyCity, request.propertyState].filter(Boolean).join(', ')}
            </Text>
          ) : null}
          <Text variant="caption" style={styles.applicantText}>
            Applicant: {request.applicantFirstName} {request.applicantLastName}
          </Text>
        </Card>

        {votes.length > 0 ? (
          <Card style={styles.sectionCard}>
            <Text variant="heading3" style={styles.sectionTitle}>
              Votes ({votes.length})
            </Text>
            {votes.map((v) => (
              <View key={v.id} style={styles.voteRow}>
                <View style={styles.voteHeader}>
                  <Text variant="bodyBold">
                    {v.memberFirstName} {v.memberLastName}
                  </Text>
                  <Badge
                    variant={v.voteValue === 'approve' ? 'success' : v.voteValue === 'deny' ? 'error' : 'warning'}
                    label={v.voteValue === 'approve' ? 'Approve' : v.voteValue === 'deny' ? 'Deny' : 'Conditional'}
                  />
                </View>
                <Text variant="caption">{v.rationale}</Text>
                {v.conflictOfInterest ? (
                  <Text variant="small" color={colors.warning.base}>Conflict of interest declared</Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {conditions.length > 0 ? (
          <Card style={styles.sectionCard}>
            <Text variant="heading3" style={styles.sectionTitle}>Conditions</Text>
            {conditions.map((c, i) => (
              <View key={i} style={styles.conditionRow}>
                <Ionicons name="checkbox-outline" size={18} color={colors.primary.base} />
                <View style={styles.conditionContent}>
                  <Text variant="body">{c.condition}</Text>
                  {c.dueDate ? (
                    <Text variant="small" color={colors.neutral.textTertiary}>Due: {c.dueDate}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            {status === ARC_STATUS.APPROVED_WITH_CONDITIONS && !isBoard ? (
              <Button
                label={acceptMutation.isPending ? 'Accepting...' : 'Accept Conditions'}
                onPress={handleAcceptConditions}
                disabled={acceptMutation.isPending}
                style={styles.acceptBtn}
                accessibilityLabel="Accept approval conditions"
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.sectionCard}>
          <Text variant="heading3" style={styles.sectionTitle}>Status Timeline</Text>
          {transitions.length === 0 ? (
            <Text variant="caption">No transitions recorded</Text>
          ) : (
            transitions.map((t, i) => (
              <TimelineEntry
                key={t.id}
                toState={t.toState}
                reason={t.reason}
                createdAt={t.createdAt}
                isLast={i === transitions.length - 1}
              />
            ))
          )}
        </Card>

        {!isTerminal && isBoard && validTransitions.length > 0 ? (
          <View style={styles.actionsSection}>
            <Text variant="heading3" style={styles.sectionTitle}>Actions</Text>
            {status === ARC_STATUS.COMMITTEE_REVIEW ? (
              <Button
                label="Review & Vote"
                onPress={() =>
                  router.push({
                    pathname: '/requests/review',
                    params: { requestId: request.id },
                  })
                }
                style={styles.actionBtn}
                accessibilityLabel="Open review and voting screen"
              />
            ) : null}
            {validTransitions.map((nextState) => (
              <Button
                key={nextState}
                label={`→ ${ARC_STATUS_LABELS[nextState] ?? nextState}`}
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: '/requests/review',
                    params: {
                      requestId: request.id,
                      transitionTo: nextState,
                    },
                  })
                }
                style={styles.actionBtn}
                accessibilityLabel={`Transition to ${ARC_STATUS_LABELS[nextState]}`}
              />
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function StatusHeader({
  status,
  daysRemainingReview,
  reviewDeadline,
  isTerminal,
}: {
  readonly status: ArcStatus;
  readonly daysRemainingReview: number | null;
  readonly reviewDeadline: string | null;
  readonly isTerminal: boolean;
}): React.ReactNode {
  const reviewColor = daysRemainingReview != null && daysRemainingReview < 0
    ? colors.error.base
    : daysRemainingReview != null && daysRemainingReview <= 3
      ? colors.error.base
      : daysRemainingReview != null && daysRemainingReview <= 7
        ? colors.warning.base
        : colors.neutral.textSecondary;

  return (
    <View style={styles.statusHeader}>
      <Badge
        variant={ARC_STATUS_BADGE_VARIANT[status]}
        label={ARC_STATUS_LABELS[status]}
      />
      {!isTerminal && daysRemainingReview != null && reviewDeadline ? (
        <View style={styles.headerDeadlineRow}>
          <Ionicons name="time-outline" size={16} color={reviewColor} />
          <Text variant="caption" color={reviewColor} style={styles.headerDeadlineText}>
            Review: {daysRemainingReview < 0
              ? `${Math.abs(daysRemainingReview)}d overdue`
              : daysRemainingReview === 0
                ? 'Due today'
                : `${daysRemainingReview}d left`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MetaItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactNode {
  return (
    <View style={styles.metaItem}>
      <Text variant="small">{label}</Text>
      <Text variant="caption" style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function TimelineEntry({
  toState,
  reason,
  createdAt,
  isLast,
}: {
  readonly toState: string;
  readonly reason: string | null;
  readonly createdAt: Date | string;
  readonly isLast: boolean;
}): React.ReactNode {
  const dateStr = typeof createdAt === 'string'
    ? createdAt.split('T')[0]
    : createdAt.toISOString().split('T')[0];
  const label = ARC_STATUS_LABELS[toState as ArcStatus] ?? toState;

  return (
    <View style={styles.timelineEntry}>
      <View style={styles.timelineDot}>
        <View style={styles.dot} />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineContent}>
        <Text variant="bodyBold">{label}</Text>
        <Text variant="small">{dateStr}</Text>
        {reason ? <Text variant="caption" style={styles.timelineReason}>{reason}</Text> : null}
      </View>
    </View>
  );
}

function LoadingState(): React.ReactNode {
  return (
    <View style={styles.loadingContainer}>
      <LoadingSkeleton width="50%" height={28} borderRadius={8} />
      <LoadingSkeleton width="100%" height={120} borderRadius={12} />
      <LoadingSkeleton width="100%" height={80} borderRadius={12} />
      <LoadingSkeleton width="100%" height={200} borderRadius={12} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  statusHeader: {
    backgroundColor: colors.neutral.background,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerDeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDeadlineText: {
    marginLeft: spacing.xs,
  },
  deemedBanner: {
    backgroundColor: colors.error.base,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  urgentBanner: {
    backgroundColor: colors.warning.base,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  protectedBanner: {
    backgroundColor: colors.primary.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bannerText: {
    flex: 1,
  },
  body: {
    padding: spacing.lg,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  descText: {
    marginTop: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  metaItem: {
    minWidth: 100,
  },
  metaValue: {
    marginTop: spacing.xs,
  },
  applicantText: {
    marginTop: spacing.sm,
  },
  voteRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  voteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  conditionContent: {
    flex: 1,
  },
  acceptBtn: {
    marginTop: spacing.lg,
  },
  timelineEntry: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timelineDot: {
    alignItems: 'center',
    width: 24,
    marginRight: spacing.md,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary.base,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.neutral.border,
    marginTop: spacing.xs,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  timelineReason: {
    marginTop: spacing.xs,
  },
  actionsSection: {
    marginTop: spacing.sm,
  },
  actionBtn: {
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingContainer: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
