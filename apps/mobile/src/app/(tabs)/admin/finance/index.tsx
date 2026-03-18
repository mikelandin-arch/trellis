import { useCallback, useMemo } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../../lib/theme';
import { Text, Card, Badge, Button, EmptyState, LoadingSkeleton } from '../../../../components/ui';

type AgingBuckets = { current: number; '30': number; '60': number; '90+': number };

export default function FinanceDashboard(): React.ReactNode {
  const trpc = useTRPC();
  const queryClient = useQueryClient();


  const communityId = 'current';

  const overdueQuery = useQuery(
    trpc.charge.listOverdue.queryOptions({ communityId }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: trpc.charge.listOverdue.queryKey() });
  }, [queryClient, trpc]);

  const { totalOutstanding, delinquencyRate, buckets, recentOverdue } = useMemo(() => {
    const data = overdueQuery.data ?? [];
    const total = data.reduce((sum, c) => sum + Number(c.balanceRemaining), 0);

    const agingBuckets: AgingBuckets = { current: 0, '30': 0, '60': 0, '90+': 0 };
    for (const charge of data) {
      const bucket = (charge.agingBucket ?? 'current') as keyof AgingBuckets;
      agingBuckets[bucket] = (agingBuckets[bucket] ?? 0) + Number(charge.balanceRemaining);
    }

    const uniqueMembers = new Set(data.map((c) => c.memberId));
    const rate = uniqueMembers.size;

    return {
      totalOutstanding: total,
      delinquencyRate: rate,
      buckets: agingBuckets,
      recentOverdue: data.slice(0, 10),
    };
  }, [overdueQuery.data]);

  const generateMutation = useMutation(
    trpc.assessment.generateCharges.mutationOptions({
      onSuccess(result) {
        Alert.alert(
          'Assessments Generated',
          `Created ${result.created} charges (${result.skipped} skipped as duplicates)`,
        );
        void queryClient.invalidateQueries({ queryKey: trpc.charge.listOverdue.queryKey() });
      },
      onError(err) {
        Alert.alert('Error', err.message);
      },
    }),
  );

  const handleGenerate = useCallback(() => {
    Alert.alert(
      'Generate Assessments',
      'This will create charges for the current billing period. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress() {
            const now = new Date();
            const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            generateMutation.mutate({
              communityId,
              periodStart,
              periodEnd,
            });
          },
        },
      ],
    );
  }, [communityId, generateMutation]);

  if (overdueQuery.isLoading) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={overdueQuery.isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary.base}
        />
      }
    >
      <Card style={styles.summaryCard}>
        <Text variant="caption">Total Outstanding</Text>
        <Text variant="heading1" style={styles.bigNumber}>
          ${totalOutstanding.toFixed(2)}
        </Text>
        <Text variant="small">
          {delinquencyRate} delinquent {delinquencyRate === 1 ? 'member' : 'members'}
        </Text>
      </Card>

      <Text variant="heading3" style={styles.sectionTitle}>AR Aging</Text>
      <View style={styles.agingRow}>
        <AgingBucket label="Current" amount={buckets.current} variant="info" />
        <AgingBucket label="30 Days" amount={buckets['30']} variant="warning" />
        <AgingBucket label="60 Days" amount={buckets['60']} variant="error" />
        <AgingBucket label="90+ Days" amount={buckets['90+']} variant="error" />
      </View>

      <Text variant="heading3" style={styles.sectionTitle}>Recent Overdue</Text>
      {recentOverdue.length > 0 ? (
        recentOverdue.map((charge) => (
          <Card key={charge.id} style={styles.overdueCard}>
            <View style={styles.overdueRow}>
              <View style={styles.overdueInfo}>
                <Text variant="body">{charge.description}</Text>
                <Text variant="small">
                  Due: {new Date(charge.dueDate).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.overdueAmount}>
                <Text variant="bodyBold">
                  ${Number(charge.balanceRemaining).toFixed(2)}
                </Text>
                <Badge
                  variant={charge.agingBucket === '90+' ? 'error' : 'warning'}
                  label={charge.agingBucket ?? 'overdue'}
                />
              </View>
            </View>
          </Card>
        ))
      ) : (
        <EmptyState
          icon="checkmark-circle-outline"
          title="All caught up"
          subtitle="No overdue charges"
        />
      )}

      <Button
        label="Generate Assessments"
        icon="calculator-outline"
        variant="secondary"
        onPress={handleGenerate}
        loading={generateMutation.isPending}
        style={styles.generateButton}
        accessibilityLabel="Generate assessment charges for the current billing period"
      />
    </ScrollView>
  );
}

function AgingBucket({
  label,
  amount,
  variant,
}: {
  readonly label: string;
  readonly amount: number;
  readonly variant: 'info' | 'warning' | 'error';
}): React.ReactNode {
  const bgColor =
    variant === 'info'
      ? colors.primary.surface
      : variant === 'warning'
        ? colors.warning.surface
        : colors.error.surface;

  return (
    <View style={[styles.agingBucket, { backgroundColor: bgColor }]}>
      <Text variant="small" style={styles.agingLabel}>{label}</Text>
      <Text variant="bodyBold">${amount.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: '700',
    marginVertical: spacing.xs,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  agingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  agingBucket: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  agingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  overdueCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  overdueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overdueInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  overdueAmount: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  generateButton: {
    marginTop: spacing.xl,
  },
});
