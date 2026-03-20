import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../lib/theme';
import {
  Text, Card, Badge, Button, LoadingSkeleton, EmptyState,
} from '../../../components/ui';
import {
  ARC_STATUS_LABELS, ARC_STATUS_BADGE_VARIANT, ARC_STATUS,
  COMPLEXITY_TIER_LABELS,
} from '@repo/shared';
import type { ArcStatus } from '@repo/shared';

type VoteChoice = 'approve' | 'deny' | 'conditional';

export default function ReviewRequestScreen(): React.ReactNode {
  const { requestId, transitionTo } = useLocalSearchParams<{
    requestId: string;
    transitionTo?: string;
  }>();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [voteChoice, setVoteChoice] = useState<VoteChoice | null>(null);
  const [rationale, setRationale] = useState('');
  const [conditionText, setConditionText] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [conflictOfInterest, setConflictOfInterest] = useState(false);
  const [transitionReason, setTransitionReason] = useState('');

  const detailQuery = useQuery(
    trpc.arcRequest.getById.queryOptions({ id: requestId! }),
  );

  const voteMutation = useMutation(trpc.arcRequest.vote.mutationOptions());
  const transitionMutation = useMutation(trpc.arcRequest.transition.mutationOptions());

  const handleAddCondition = useCallback(() => {
    if (!conditionText.trim()) return;
    setConditions((prev) => [...prev, conditionText.trim()]);
    setConditionText('');
  }, [conditionText]);

  const handleRemoveCondition = useCallback((index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleVoteSubmit = useCallback(async () => {
    if (!voteChoice || !rationale.trim()) return;

    try {
      await voteMutation.mutateAsync({
        requestId: requestId!,
        voteValue: voteChoice,
        rationale: rationale.trim(),
        conditionsProposed: voteChoice === 'conditional'
          ? conditions.map((c) => ({ condition: c }))
          : undefined,
        conflictOfInterest,
      });

      void queryClient.invalidateQueries({
        queryKey: trpc.arcRequest.getById.queryKey({ id: requestId! }),
      });
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit vote.';
      Alert.alert('Error', message);
    }
  }, [voteChoice, rationale, conditions, conflictOfInterest, voteMutation, requestId, queryClient, trpc, router]);

  const handleTransition = useCallback(async () => {
    if (!transitionTo || !transitionReason.trim()) return;

    try {
      await transitionMutation.mutateAsync({
        requestId: requestId!,
        toState: transitionTo,
        reason: transitionReason.trim(),
      });

      void queryClient.invalidateQueries({
        queryKey: trpc.arcRequest.getById.queryKey({ id: requestId! }),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.arcRequest.list.queryKey(),
      });
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status.';
      Alert.alert('Error', message);
    }
  }, [transitionTo, transitionReason, transitionMutation, requestId, queryClient, trpc, router]);

  if (detailQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSkeleton width="60%" height={28} borderRadius={8} />
        <LoadingSkeleton width="100%" height={200} borderRadius={12} />
      </View>
    );
  }

  if (!detailQuery.data) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState icon="alert-circle-outline" title="Not found" subtitle="Request not found" />
      </View>
    );
  }

  const { request, votes, deemedApproved, protectedModification } = detailQuery.data;
  const status = request.status as ArcStatus;
  const isCommitteeReview = status === ARC_STATUS.COMMITTEE_REVIEW;
  const isTransitionMode = !!transitionTo && !isCommitteeReview;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Badge
              variant={ARC_STATUS_BADGE_VARIANT[status]}
              label={ARC_STATUS_LABELS[status]}
            />
            <Text variant="small" color={colors.neutral.textTertiary}>
              {COMPLEXITY_TIER_LABELS[request.complexityTier] ?? 'Standard'}
            </Text>
          </View>
          <Text variant="heading3" style={styles.requestTitle}>{request.title}</Text>
          <Text variant="body">{request.description}</Text>
          <View style={styles.metaRow}>
            <Text variant="small">Property: {request.propertyAddress ?? 'Unknown'}</Text>
            <Text variant="small">
              Applicant: {request.applicantFirstName} {request.applicantLastName}
            </Text>
            {request.estimatedCost ? (
              <Text variant="small">Cost: ${Number(request.estimatedCost).toLocaleString()}</Text>
            ) : null}
          </View>
        </Card>

        {deemedApproved.isDeemedApproved ? (
          <View style={styles.deemedBanner}>
            <Ionicons name="warning" size={18} color={colors.neutral.background} />
            <Text variant="bodyBold" color={colors.neutral.background} style={styles.bannerText}>
              DEEMED APPROVED — Deadline has passed.
            </Text>
          </View>
        ) : null}

        {protectedModification ? (
          <View style={styles.protectedBanner}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary.light} />
            <Text variant="small" color={colors.primary.light} style={styles.bannerText}>
              Protected: {protectedModification.law}. Cannot be denied.
            </Text>
          </View>
        ) : null}

        {votes.length > 0 ? (
          <Card style={styles.sectionCard}>
            <Text variant="heading3" style={styles.sectionTitle}>
              Previous Votes ({votes.length})
            </Text>
            {votes.map((v) => (
              <View key={v.id} style={styles.voteRow}>
                <View style={styles.voteRowHeader}>
                  <Text variant="bodyBold">{v.memberFirstName} {v.memberLastName}</Text>
                  <Badge
                    variant={v.voteValue === 'approve' ? 'success' : v.voteValue === 'deny' ? 'error' : 'warning'}
                    label={v.voteValue}
                  />
                </View>
                <Text variant="caption">{v.rationale}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {isTransitionMode ? (
          <Card style={styles.sectionCard}>
            <Text variant="heading3" style={styles.sectionTitle}>
              Transition to: {ARC_STATUS_LABELS[transitionTo as ArcStatus] ?? transitionTo}
            </Text>
            <Text variant="bodyBold" style={styles.fieldLabel}>Reason</Text>
            <TextInput
              value={transitionReason}
              onChangeText={setTransitionReason}
              placeholder="Explain the reason for this status change..."
              multiline
              numberOfLines={4}
              style={styles.textArea}
              accessibilityLabel="Transition reason"
            />
            <Button
              label={transitionMutation.isPending ? 'Updating...' : 'Update Status'}
              onPress={handleTransition}
              disabled={transitionMutation.isPending || !transitionReason.trim()}
              style={styles.submitBtn}
              accessibilityLabel="Submit status transition"
            />
          </Card>
        ) : null}

        {isCommitteeReview ? (
          <>
            <Card style={styles.sectionCard}>
              <Text variant="heading3" style={styles.sectionTitle}>Cast Your Vote</Text>

              <View style={styles.voteButtons}>
                {(['approve', 'deny', 'conditional'] as const).map((choice) => {
                  const isSelected = voteChoice === choice;
                  const label = choice === 'approve' ? 'Approve' : choice === 'deny' ? 'Deny' : 'Conditional';
                  const icon = choice === 'approve' ? 'checkmark-circle' : choice === 'deny' ? 'close-circle' : 'alert-circle';
                  const btnColor = choice === 'approve' ? colors.success.base : choice === 'deny' ? colors.error.base : colors.warning.base;

                  return (
                    <Pressable
                      key={choice}
                      onPress={() => setVoteChoice(choice)}
                      style={[
                        styles.voteBtn,
                        isSelected && { borderColor: btnColor, backgroundColor: btnColor + '15' },
                      ]}
                      accessibilityLabel={`Vote ${label}`}
                    >
                      <Ionicons name={icon} size={28} color={isSelected ? btnColor : colors.neutral.textTertiary} />
                      <Text
                        variant="bodyBold"
                        color={isSelected ? btnColor : colors.neutral.textSecondary}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text variant="bodyBold" style={[styles.fieldLabel, styles.fieldGap]}>
                Rationale (required)
              </Text>
              <TextInput
                value={rationale}
                onChangeText={setRationale}
                placeholder="Explain your vote..."
                multiline
                numberOfLines={4}
                style={styles.textArea}
                accessibilityLabel="Vote rationale"
              />

              {voteChoice === 'conditional' ? (
                <View style={styles.fieldGap}>
                  <Text variant="bodyBold" style={styles.fieldLabel}>Conditions</Text>
                  {conditions.map((c, i) => (
                    <View key={i} style={styles.conditionRow}>
                      <Text variant="body" style={styles.conditionText}>{c}</Text>
                      <Pressable
                        onPress={() => handleRemoveCondition(i)}
                        accessibilityLabel={`Remove condition: ${c}`}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.error.base} />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.addConditionRow}>
                    <TextInput
                      value={conditionText}
                      onChangeText={setConditionText}
                      placeholder="Add a condition..."
                      style={styles.conditionInput}
                      accessibilityLabel="New condition text"
                    />
                    <Button label="Add" onPress={handleAddCondition} disabled={!conditionText.trim()} />
                  </View>
                </View>
              ) : null}

              <View style={[styles.switchRow, styles.fieldGap]}>
                <Text variant="body">Conflict of Interest</Text>
                <Switch
                  value={conflictOfInterest}
                  onValueChange={setConflictOfInterest}
                  accessibilityLabel="Declare conflict of interest"
                />
              </View>

              {conflictOfInterest ? (
                <Text variant="small" color={colors.warning.base} style={styles.conflictWarning}>
                  You have declared a conflict of interest. You will be recused from this vote.
                </Text>
              ) : null}
            </Card>

            <Button
              label={voteMutation.isPending ? 'Submitting...' : 'Submit Vote'}
              onPress={handleVoteSubmit}
              disabled={voteMutation.isPending || !voteChoice || !rationale.trim() || conflictOfInterest}
              style={styles.submitBtn}
              accessibilityLabel="Submit your vote"
            />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 100,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  requestTitle: {
    marginBottom: spacing.sm,
  },
  metaRow: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  deemedBanner: {
    backgroundColor: colors.error.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  protectedBanner: {
    backgroundColor: colors.primary.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bannerText: {
    flex: 1,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  voteRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  voteRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  voteButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  voteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.background,
    gap: spacing.xs,
    minHeight: 80,
  },
  fieldLabel: {
    marginBottom: spacing.sm,
  },
  fieldGap: {
    marginTop: spacing.lg,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: 18,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.background,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  conditionText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  addConditionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  conditionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.background,
    minHeight: 48,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conflictWarning: {
    marginTop: spacing.sm,
  },
  submitBtn: {
    marginTop: spacing.md,
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
