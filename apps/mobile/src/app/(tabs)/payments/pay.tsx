import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../lib/theme';
import { Text, Card, Button } from '../../../components/ui';

type MethodOption = 'ach' | 'card';

const CARD_FEE_RATE = 0.029;
const CARD_FEE_FIXED = 0.30;

export default function PayScreen(): React.ReactNode {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedMethod, setSelectedMethod] = useState<MethodOption>('ach');
  const [confirming, setConfirming] = useState(false);

  const memberId = 'current';

  const chargesQuery = useQuery(
    trpc.charge.listByMember.queryOptions({
      memberId,
      status: ['due', 'overdue', 'partial'],
      limit: 50,
    }),
  );

  const subtotal = useMemo(() => {
    if (!chargesQuery.data) return 0;
    return chargesQuery.data.reduce(
      (sum, c) => sum + Number(c.balanceRemaining),
      0,
    );
  }, [chargesQuery.data]);

  const convenienceFee = useMemo(() => {
    if (selectedMethod === 'ach') return 0;
    return Math.round((subtotal * CARD_FEE_RATE + CARD_FEE_FIXED) * 100) / 100;
  }, [subtotal, selectedMethod]);

  const total = subtotal + convenienceFee;

  const createPaymentMutation = useMutation(
    trpc.payment.createPaymentIntent.mutationOptions({
      onSuccess() {
        void queryClient.invalidateQueries({ queryKey: trpc.charge.listByMember.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.payment.listByMember.queryKey() });
        router.back();
      },
    }),
  );

  const handlePay = useCallback(() => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    const chargeIds = chargesQuery.data?.map((c) => c.id);

    createPaymentMutation.mutate({
      memberId,
      amount: total,
      paymentMethod: selectedMethod,
      chargeIds,
    });
  }, [confirming, chargesQuery.data, total, selectedMethod, createPaymentMutation, memberId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card header="Charges" style={styles.section}>
        {chargesQuery.data?.map((charge) => (
          <View key={charge.id} style={styles.chargeRow}>
            <Text variant="body" style={styles.chargeDesc}>
              {charge.description}
            </Text>
            <Text variant="bodyBold">
              ${Number(charge.balanceRemaining).toFixed(2)}
            </Text>
          </View>
        ))}
      </Card>

      <Card header="Payment Method" style={styles.section}>
        <Pressable
          style={[styles.methodRow, selectedMethod === 'ach' && styles.methodSelected]}
          onPress={() => { setSelectedMethod('ach'); setConfirming(false); }}
          accessibilityLabel="Pay by ACH bank transfer, no fee"
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedMethod === 'ach' }}
        >
          <Ionicons
            name="business-outline"
            size={24}
            color={selectedMethod === 'ach' ? colors.primary.base : colors.neutral.textSecondary}
          />
          <View style={styles.methodInfo}>
            <Text variant="body">Bank Account (ACH)</Text>
            <Text variant="small" color={colors.success.dark}>No fee</Text>
          </View>
          {selectedMethod === 'ach' && (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary.base} />
          )}
        </Pressable>

        <Pressable
          style={[styles.methodRow, selectedMethod === 'card' && styles.methodSelected]}
          onPress={() => { setSelectedMethod('card'); setConfirming(false); }}
          accessibilityLabel={`Pay by credit or debit card, ${CARD_FEE_RATE * 100}% plus $${CARD_FEE_FIXED} convenience fee`}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedMethod === 'card' }}
        >
          <Ionicons
            name="card-outline"
            size={24}
            color={selectedMethod === 'card' ? colors.primary.base : colors.neutral.textSecondary}
          />
          <View style={styles.methodInfo}>
            <Text variant="body">Credit / Debit Card</Text>
            <Text variant="small" color={colors.warning.dark}>
              {CARD_FEE_RATE * 100}% + ${CARD_FEE_FIXED.toFixed(2)} convenience fee
            </Text>
          </View>
          {selectedMethod === 'card' && (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary.base} />
          )}
        </Pressable>
      </Card>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text variant="body">Subtotal</Text>
          <Text variant="body">${subtotal.toFixed(2)}</Text>
        </View>
        {convenienceFee > 0 && (
          <View style={styles.summaryRow}>
            <Text variant="body">Convenience Fee</Text>
            <Text variant="body">${convenienceFee.toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text variant="heading3">Total</Text>
          <Text variant="heading3">${total.toFixed(2)}</Text>
        </View>
      </Card>

      <Button
        label={confirming ? 'Confirm Payment' : 'Review Payment'}
        icon={confirming ? 'lock-closed-outline' : 'card-outline'}
        onPress={handlePay}
        loading={createPaymentMutation.isPending}
        disabled={subtotal <= 0}
        style={styles.payButton}
        accessibilityLabel={confirming ? 'Confirm and submit payment' : 'Review payment details'}
      />

      {confirming && (
        <Pressable
          onPress={() => setConfirming(false)}
          style={styles.cancelLink}
          accessibilityLabel="Go back to edit payment"
          accessibilityRole="button"
        >
          <Text variant="caption" color={colors.primary.base}>
            Go Back
          </Text>
        </Pressable>
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
  chargeDesc: {
    flex: 1,
    marginRight: spacing.md,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  methodSelected: {
    borderColor: colors.primary.base,
    backgroundColor: colors.primary.surface,
  },
  methodInfo: {
    flex: 1,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  payButton: {
    marginBottom: spacing.md,
  },
  cancelLink: {
    alignItems: 'center',
    padding: spacing.md,
  },
});
