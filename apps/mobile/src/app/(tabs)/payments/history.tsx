import { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing } from '../../../lib/theme';
import { Text, Card, Badge, EmptyState, LoadingSkeleton } from '../../../components/ui';

const STATUS_BADGE = {
  succeeded: { variant: 'success' as const, label: 'Succeeded' },
  processing: { variant: 'info' as const, label: 'Processing' },
  pending: { variant: 'neutral' as const, label: 'Pending' },
  failed: { variant: 'error' as const, label: 'Failed' },
  refunded: { variant: 'warning' as const, label: 'Refunded' },
  disputed: { variant: 'error' as const, label: 'Disputed' },
} as const;

const METHOD_LABELS: Record<string, string> = {
  ach: 'Bank (ACH)',
  credit_card: 'Credit Card',
  check: 'Check',
  cash: 'Cash',
  lockbox: 'Lockbox',
  wire: 'Wire',
  online_portal: 'Online',
};

type PaymentItem = {
  id: string;
  amount: string;
  paymentMethod: string;
  status: string;
  paymentDate: string;
};

function PaymentRow({ item }: { readonly item: PaymentItem }): React.ReactNode {
  const badge = STATUS_BADGE[item.status as keyof typeof STATUS_BADGE] ?? {
    variant: 'neutral' as const,
    label: item.status,
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text variant="bodyBold">${Number(item.amount).toFixed(2)}</Text>
          <Text variant="small">
            {new Date(item.paymentDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          <Text variant="small">
            {METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}
          </Text>
        </View>
        <Badge variant={badge.variant} label={badge.label} />
      </View>
    </Card>
  );
}

export default function PaymentHistoryScreen(): React.ReactNode {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const memberId = 'current';

  const paymentsQuery = useQuery(
    trpc.payment.listByMember.queryOptions({
      memberId,
      limit: 100,
    }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: trpc.payment.listByMember.queryKey() });
  }, [queryClient, trpc]);

  if (paymentsQuery.isLoading) {
    return (
      <View style={styles.container}>
        <LoadingSkeleton />
      </View>
    );
  }

  if (!paymentsQuery.data || paymentsQuery.data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="receipt-outline"
          title="No payments"
          subtitle="Your payment history will appear here once you make a payment"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={paymentsQuery.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PaymentRow item={item} />}
        estimatedItemSize={90}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={paymentsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.base}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  listContent: {
    padding: spacing.lg,
  },
  card: {
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  separator: {
    height: spacing.sm,
  },
});
