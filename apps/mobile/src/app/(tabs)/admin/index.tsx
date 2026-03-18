import { useCallback } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing, borderRadius, shadows } from '../../../lib/theme';
import {
  Text, Card, Badge, LoadingSkeleton, Button,
} from '../../../components/ui';
import {
  VIOLATION_STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  TERMINAL_STATES,
} from '@repo/shared';
import type { ViolationStatus } from '@repo/shared';

export default function AdminDashboard(): React.ReactNode {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const violationQuery = useQuery(
    trpc.violation.list.queryOptions({ limit: 5 }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.violation.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const violations = violationQuery.data?.items ?? [];
  const isLoading = violationQuery.isLoading;

  const openCount = violations.filter(
    (v) => !TERMINAL_STATES.includes(v.status as ViolationStatus),
  ).length;

  const today = new Date().toISOString().split('T')[0]!;
  const overdueCount = violations.filter(
    (v) => v.cureDeadline && v.cureDeadline < today && !TERMINAL_STATES.includes(v.status as ViolationStatus),
  ).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={violationQuery.isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary.base}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="heading1">Admin</Text>
        <Text variant="caption">Board management tools</Text>
      </View>

      {isLoading ? (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <LoadingSkeleton width={48} height={48} borderRadius={24} />
            <LoadingSkeleton width={40} height={28} borderRadius={6} />
          </View>
          <View style={styles.summaryGap} />
          <View style={styles.summaryCard}>
            <LoadingSkeleton width={48} height={48} borderRadius={24} />
            <LoadingSkeleton width={40} height={28} borderRadius={6} />
          </View>
        </View>
      ) : (
        <View style={styles.summaryRow}>
          <SummaryCard icon="alert-circle" value={String(openCount)} label="Open" color={colors.warning.base} />
          <View style={styles.summaryGap} />
          <SummaryCard icon="time" value={String(overdueCount)} label="Overdue" color={colors.error.base} />
        </View>
      )}

      <View style={styles.section}>
        <Button
          label="Report Violation"
          icon="camera-outline"
          onPress={() => router.push('/admin/violations/report')}
          accessibilityLabel="Report a new violation"
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="heading3">Recent Violations</Text>
          <Pressable
            onPress={() => router.push('/admin/violations')}
            accessibilityLabel="View all violations"
            style={styles.viewAllBtn}
          >
            <Text variant="bodyBold" color={colors.primary.base}>View All</Text>
          </Pressable>
        </View>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} style={styles.violationCard}>
              <LoadingSkeleton width="60%" height={20} borderRadius={6} />
              <LoadingSkeleton width="40%" height={16} borderRadius={4} />
            </Card>
          ))
        ) : violations.length === 0 ? (
          <Card>
            <Text variant="body" align="center">No violations reported yet</Text>
          </Card>
        ) : (
          violations.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => router.push(`/admin/violations/${v.id}`)}
              accessibilityLabel={`View violation: ${v.title}`}
            >
              <Card style={styles.violationCard}>
                <View style={styles.violationRow}>
                  <View style={styles.violationInfo}>
                    <Text variant="bodyBold" numberOfLines={1}>{v.title}</Text>
                    <Text variant="caption" numberOfLines={1}>
                      {v.propertyAddress ?? 'Unknown address'}
                    </Text>
                  </View>
                  <Badge
                    variant={STATUS_BADGE_VARIANT[v.status as ViolationStatus] ?? 'neutral'}
                    label={VIOLATION_STATUS_LABELS[v.status as ViolationStatus] ?? v.status}
                  />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  color,
}: {
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly value: string;
  readonly label: string;
  readonly color: string;
}): React.ReactNode {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.iconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text variant="heading2">{value}</Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: colors.neutral.background,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  summaryGap: {
    width: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewAllBtn: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  violationCard: {
    marginBottom: spacing.sm,
  },
  violationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  violationInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
});
