import { useCallback } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../../lib/theme';
import {
  Text, Card, Badge, Button, LoadingSkeleton, EmptyState,
} from '../../../../components/ui';
import {
  VIOLATION_STATUS_LABELS, STATUS_BADGE_VARIANT,
  VIOLATION_SEVERITY_LABELS, TERMINAL_STATES,
} from '@repo/shared';
import type { ViolationStatus } from '@repo/shared';

function computeDaysRemaining(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

export default function ViolationDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const detailQuery = useQuery(
    trpc.violation.getById.queryOptions({ id: id! }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.violation.getById.queryKey({ id: id! }),
    });
  }, [queryClient, trpc, id]);

  if (detailQuery.isLoading) {
    return <LoadingState />;
  }

  if (!detailQuery.data) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState icon="alert-circle-outline" title="Not found" subtitle="This violation could not be loaded" />
      </View>
    );
  }

  const { violation, transitions, evidence, validTransitions } = detailQuery.data;
  const status = violation.status as ViolationStatus;
  const isTerminal = TERMINAL_STATES.includes(status);
  const cureDeadline = violation.cureDeadline;

  const daysRemaining = cureDeadline && !isTerminal
    ? computeDaysRemaining(cureDeadline)
    : null;

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
        daysRemaining={daysRemaining}
        cureDeadline={violation.cureDeadline}
      />

      <View style={styles.body}>
        <Card style={styles.sectionCard}>
          <Text variant="heading3" style={styles.sectionTitle}>Violation</Text>
          <Text variant="bodyBold">{violation.title}</Text>
          {violation.description ? (
            <Text variant="body" style={styles.descText}>{violation.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <MetaItem label="Severity" value={VIOLATION_SEVERITY_LABELS[violation.severity as keyof typeof VIOLATION_SEVERITY_LABELS] ?? violation.severity} />
            <MetaItem label="Category" value={violation.categoryName ?? 'Uncategorized'} />
            <MetaItem label="Reported" value={violation.reportedDate} />
            <MetaItem label="Source" value={violation.source.replace(/_/g, ' ')} />
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text variant="heading3" style={styles.sectionTitle}>Property</Text>
          <Text variant="bodyBold">{violation.propertyAddress ?? 'Unknown address'}</Text>
          {violation.propertyLot ? (
            <Text variant="caption">Lot {violation.propertyLot}</Text>
          ) : null}
          {violation.propertyCity ? (
            <Text variant="caption">
              {[violation.propertyCity, violation.propertyState].filter(Boolean).join(', ')}
            </Text>
          ) : null}
        </Card>

        <EvidenceGallery evidence={evidence} />

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

        {!isTerminal && validTransitions.length > 0 ? (
          <View style={styles.actionsSection}>
            <Text variant="heading3" style={styles.sectionTitle}>Actions</Text>
            {validTransitions.map((nextState) => (
              <Button
                key={nextState}
                label={VIOLATION_STATUS_LABELS[nextState] ?? nextState}
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: '/admin/violations/transition',
                    params: { violationId: violation.id, currentStatus: status },
                  })
                }
                style={styles.actionBtn}
                accessibilityLabel={`Transition to ${VIOLATION_STATUS_LABELS[nextState]}`}
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
  daysRemaining,
  cureDeadline,
}: {
  readonly status: ViolationStatus;
  readonly daysRemaining: number | null;
  readonly cureDeadline: string | null;
}): React.ReactNode {
  const deadlineColor = daysRemaining != null && daysRemaining < 0
    ? colors.error.base
    : daysRemaining != null && daysRemaining <= 7
      ? colors.warning.base
      : colors.neutral.textSecondary;

  return (
    <View style={styles.statusHeader}>
      <Badge
        variant={STATUS_BADGE_VARIANT[status]}
        label={VIOLATION_STATUS_LABELS[status]}
      />
      {daysRemaining != null && cureDeadline ? (
        <View style={styles.deadlineRow}>
          <Ionicons name="time-outline" size={16} color={deadlineColor} />
          <Text variant="caption" color={deadlineColor} style={styles.deadlineText}>
            {daysRemaining < 0
              ? `${Math.abs(daysRemaining)} days overdue`
              : daysRemaining === 0
                ? 'Due today'
                : `${daysRemaining} days remaining`}
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

function EvidenceGallery({
  evidence,
}: {
  readonly evidence: ReadonlyArray<{
    id: string;
    evidenceType: string;
    fileUrl: string | null;
    description: string | null;
  }>;
}): React.ReactNode {
  if (evidence.length === 0) return null;

  return (
    <Card style={styles.sectionCard}>
      <Text variant="heading3" style={styles.sectionTitle}>
        Evidence ({evidence.length})
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {evidence.map((e) => (
          <View key={e.id} style={styles.evidenceThumb}>
            {e.fileUrl && e.evidenceType === 'photo' ? (
              <Image
                source={{ uri: e.fileUrl }}
                style={styles.evidenceImage}
                accessibilityRole="image"
                accessibilityLabel={e.description ?? 'Violation evidence photo'}
              />
            ) : (
              <View style={styles.evidencePlaceholder}>
                <Ionicons
                  name={e.evidenceType === 'video' ? 'videocam-outline' : 'document-outline'}
                  size={28}
                  color={colors.neutral.textTertiary}
                />
              </View>
            )}
            {e.description ? (
              <Text variant="small" numberOfLines={1} style={styles.evidenceCaption}>
                {e.description}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </Card>
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
  const label = VIOLATION_STATUS_LABELS[toState as ViolationStatus] ?? toState;

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
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineText: {
    marginLeft: spacing.xs,
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
  evidenceThumb: {
    marginRight: spacing.md,
    width: 120,
  },
  evidenceImage: {
    width: 120,
    height: 90,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.neutral.surface,
  },
  evidencePlaceholder: {
    width: 120,
    height: 90,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.neutral.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  evidenceCaption: {
    marginTop: spacing.xs,
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
