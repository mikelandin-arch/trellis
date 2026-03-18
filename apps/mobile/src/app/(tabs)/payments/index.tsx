import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing } from '../../../lib/theme';
import { Text, Card, Badge, Button, EmptyState, LoadingSkeleton } from '../../../components/ui';

const PAYMENT_STATUS_BADGE = {
  succeeded: 'success',
  processing: 'info',
  pending: 'neutral',
  failed: 'error',
  refunded: 'warning',
  disputed: 'error',
} as const;

export default function PaymentsDashboard(): React.ReactNode {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const memberId = 'current';

  const chargesQuery = useQuery(
    trpc.charge.listByMember.queryOptions({
      memberId,
      status: ['due', 'overdue', 'partial'],
      limit: 50,
    }),
  );

  const paymentsQuery = useQuery(
    trpc.payment.listByMember.queryOptions({
      memberId,
      limit: 10,
    }),
  );

  const totalBalance = useMemo(() => {
    if (!chargesQuery.data) return 0;
    return chargesQuery.data.reduce(
      (sum, c) => sum + Number(c.balanceRemaining),
      0,
    );
  }, [chargesQuery.data]);

  const nextDueDate = useMemo(() => {
    if (!chargesQuery.data || chargesQuery.data.length === 0) return null;
    const sorted = [...chargesQuery.data].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
    return sorted[0]?.dueDate ?? null;
  }, [chargesQuery.data]);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: trpc.charge.listByMember.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.payment.listByMember.queryKey() });
  }, [queryClient, trpc]);

  const isLoading = chargesQuery.isLoading || paymentsQuery.isLoading;

  if (isLoading) {
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
          refreshing={chargesQuery.isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary.base}
        />
      }
    >
      <Card style={styles.balanceCard}>
        <Text variant="caption" style={styles.balanceLabel}>
          Current Balance
        </Text>
        <Text variant="heading1" style={styles.balanceAmount}>
          ${totalBalance.toFixed(2)}
        </Text>
        {nextDueDate && (
          <Text variant="small" style={styles.dueDate}>
            Next due: {new Date(nextDueDate).toLocaleDateString()}
          </Text>
        )}
        {totalBalance > 0 && (
          <Button
            label="Pay Now"
            icon="card-outline"
            onPress={() => router.push('/payments/pay')}
            style={styles.payButton}
            accessibilityLabel="Make a payment"
          />
        )}
      </Card>

      {chargesQuery.data && chargesQuery.data.length > 0 && (
        <Card header="Outstanding Charges" style={styles.section}>
          {chargesQuery.data.map((charge) => (
            <View key={charge.id} style={styles.chargeRow}>
              <View style={styles.chargeInfo}>
                <Text variant="body">{charge.description}</Text>
                <Text variant="small">Due: {new Date(charge.dueDate).toLocaleDateString()}</Text>
              </View>
              <View style={styles.chargeAmountCol}>
                <Text variant="bodyBold">${Number(charge.balanceRemaining).toFixed(2)}</Text>
                <Badge
                  variant={charge.status === 'overdue' ? 'error' : 'warning'}
                  label={charge.status}
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      <View style={styles.sectionHeader}>
        <Text variant="heading3">Recent Payments</Text>
        <Pressable
          onPress={() => router.push('/payments/history')}
          accessibilityLabel="View all payment history"
          accessibilityRole="button"
        >
          <Text variant="caption" color={colors.primary.base}>
            View All
          </Text>
        </Pressable>
      </View>

      {paymentsQuery.data && paymentsQuery.data.length > 0 ? (
        <View style={styles.paymentsList}>
          {paymentsQuery.data.slice(0, 5).map((payment) => (
            <Card key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text variant="body">
                    ${Number(payment.amount).toFixed(2)}
                  </Text>
                  <Text variant="small">
                    {new Date(payment.paymentDate).toLocaleDateString()} · {payment.paymentMethod}
                  </Text>
                </View>
                <Badge
                  variant={PAYMENT_STATUS_BADGE[payment.status as keyof typeof PAYMENT_STATUS_BADGE] ?? 'neutral'}
                  label={payment.status}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="receipt-outline"
          title="No payments yet"
          subtitle="Your payment history will appear here"
        />
      )}
    </ScrollView>
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
  balanceCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
  },
  dueDate: {
    marginTop: spacing.xs,
  },
  payButton: {
    marginTop: spacing.lg,
    width: '100%',
  },
  section: {
    marginBottom: spacing.lg,
  },
  chargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  chargeInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  chargeAmountCol: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  paymentsList: {
    gap: spacing.sm,
  },
  paymentCard: {
    padding: spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
});
