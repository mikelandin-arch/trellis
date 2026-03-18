import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../../lib/theme';
import { Text, Badge, Button, Input } from '../../../../components/ui';
import {
  VIOLATION_STATUS, VIOLATION_STATUS_LABELS,
  STATUS_BADGE_VARIANT, VALID_TRANSITIONS,
} from '@repo/shared';
import type { ViolationStatus } from '@repo/shared';

export default function TransitionScreen(): React.ReactNode {
  const { violationId, currentStatus } = useLocalSearchParams<{
    violationId: string;
    currentStatus: string;
  }>();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedState, setSelectedState] = useState<ViolationStatus | null>(null);
  const [reason, setReason] = useState('');
  const [hearingDate, setHearingDate] = useState('');
  const [fineAmount, setFineAmount] = useState('');

  const transitionMutation = useMutation(trpc.violation.transition.mutationOptions());

  const status = currentStatus as ViolationStatus;
  const validNext = (VALID_TRANSITIONS[status] ?? []) as readonly ViolationStatus[];

  const needsHearingDate = selectedState === VIOLATION_STATUS.HEARING_SCHEDULED;
  const needsFineAmount = selectedState === VIOLATION_STATUS.FINE_ASSESSED;

  const canSubmit = selectedState != null
    && reason.trim().length > 0
    && (!needsHearingDate || hearingDate.length > 0)
    && (!needsFineAmount || (fineAmount.length > 0 && Number(fineAmount) > 0));

  const handleSubmit = useCallback(async () => {
    if (!selectedState || !violationId) return;

    try {
      await transitionMutation.mutateAsync({
        violationId,
        toState: selectedState,
        reason: reason.trim(),
        hearingDate: needsHearingDate ? new Date(hearingDate) : undefined,
        fineAmount: needsFineAmount ? Number(fineAmount) : undefined,
      });

      void queryClient.invalidateQueries({ queryKey: trpc.violation.getById.queryKey({ id: violationId }) });
      void queryClient.invalidateQueries({ queryKey: trpc.violation.list.queryKey() });
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transition failed';
      Alert.alert('Error', message);
    }
  }, [selectedState, violationId, reason, hearingDate, fineAmount, needsHearingDate, needsFineAmount, transitionMutation, queryClient, trpc, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.currentStatus}>
          <Text variant="caption">Current Status</Text>
          <Badge
            variant={STATUS_BADGE_VARIANT[status]}
            label={VIOLATION_STATUS_LABELS[status] ?? status}
          />
        </View>

        <Text variant="heading3" style={styles.sectionTitle}>Transition To</Text>
        <View style={styles.stateOptions}>
          {validNext.map((nextState) => {
            const isSelected = selectedState === nextState;
            return (
              <Pressable
                key={nextState}
                onPress={() => setSelectedState(nextState)}
                style={[styles.stateOption, isSelected && styles.stateOptionActive]}
                accessibilityLabel={`Select ${VIOLATION_STATUS_LABELS[nextState]}`}
                accessibilityRole="radio"
              >
                <View style={styles.stateOptionContent}>
                  <Badge
                    variant={STATUS_BADGE_VARIANT[nextState]}
                    label={VIOLATION_STATUS_LABELS[nextState]}
                  />
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary.base} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fieldSection}>
          <Text variant="bodyBold" style={styles.fieldLabel}>Reason *</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Explain the reason for this transition..."
            multiline
            numberOfLines={3}
            style={styles.textArea}
            accessibilityLabel="Transition reason"
          />
        </View>

        {needsHearingDate ? (
          <View style={styles.fieldSection}>
            <Input
              label="Hearing Date *"
              value={hearingDate}
              onChangeText={setHearingDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />
            <Text variant="small" style={styles.fieldHint}>
              WA requires at least 14 days notice before a hearing
            </Text>
          </View>
        ) : null}

        {needsFineAmount ? (
          <View style={styles.fieldSection}>
            <Input
              label="Fine Amount ($) *"
              value={fineAmount}
              onChangeText={setFineAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <Text variant="small" style={styles.fieldHint}>
              WA: Fine must follow a previously established schedule and the homeowner must have had an opportunity to be heard
            </Text>
          </View>
        ) : null}

        <Button
          label={transitionMutation.isPending ? 'Updating...' : 'Confirm Transition'}
          onPress={handleSubmit}
          disabled={!canSubmit || transitionMutation.isPending}
          style={styles.submitBtn}
          accessibilityLabel="Confirm status transition"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.background,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  stateOptions: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    minHeight: 56,
  },
  stateOptionActive: {
    borderColor: colors.primary.base,
    backgroundColor: colors.primary.surface,
  },
  stateOptionContent: {
    flex: 1,
  },
  fieldSection: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    marginBottom: spacing.sm,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: 18,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.background,
  },
  fieldHint: {
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
});
