import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../lib/theme';
import { Text, Card, Button, Input, Badge } from '../../../components/ui';
import { COMPLEXITY_TIER_LABELS } from '@repo/shared';

const TOTAL_STEPS = 4;

interface WizardState {
  modificationTypeId: string | null;
  modificationTypeName: string;
  complexityTier: number;
  requiredDocuments: string[];
  title: string;
  description: string;
  estimatedCost: string;
  estimatedStartDate: string;
  estimatedCompletionDate: string;
  propertyId: string | null;
  propertyLabel: string;
  photoUri: string | null;
}

const INITIAL_STATE: WizardState = {
  modificationTypeId: null,
  modificationTypeName: '',
  complexityTier: 2,
  requiredDocuments: [],
  title: '',
  description: '',
  estimatedCost: '',
  estimatedStartDate: '',
  estimatedCompletionDate: '',
  propertyId: null,
  propertyLabel: '',
  photoUri: null,
};

export default function NewRequestScreen(): React.ReactNode {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [propertySearch, setPropertySearch] = useState('');

  const modTypeQuery = useQuery(trpc.arcModificationType.list.queryOptions());
  const propertyQuery = useQuery(trpc.property.list.queryOptions({ limit: 100 }));

  const createMutation = useMutation(trpc.arcRequest.create.mutationOptions());

  const modTypes = modTypeQuery.data ?? [];

  const groupedTypes = useMemo(() => {
    const groups: Record<number, typeof modTypes> = { 1: [], 2: [], 3: [] };
    for (const t of modTypes) {
      const tier = t.complexityTier ?? 2;
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(t);
    }
    return groups;
  }, [modTypes]);

  const filteredProperties = useMemo(() => {
    const items = propertyQuery.data?.items ?? [];
    if (!propertySearch) return items;
    const q = propertySearch.toLowerCase();
    return items.filter(
      (p) =>
        p.addressLine1?.toLowerCase().includes(q) ||
        p.lotNumber?.toLowerCase().includes(q),
    );
  }, [propertyQuery.data?.items, propertySearch]);

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setState((s) => ({ ...s, photoUri: result.assets[0]!.uri }));
    }
  }, []);

  const handlePickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ['images'],
    });
    if (!result.canceled && result.assets[0]) {
      setState((s) => ({ ...s, photoUri: result.assets[0]!.uri }));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!state.modificationTypeId || !state.title || !state.description || !state.propertyId) return;

    try {
      await createMutation.mutateAsync({
        propertyId: state.propertyId,
        modificationTypeId: state.modificationTypeId,
        title: state.title,
        description: state.description,
        estimatedCost: state.estimatedCost ? parseFloat(state.estimatedCost) : undefined,
        estimatedStartDate: state.estimatedStartDate ? new Date(state.estimatedStartDate) : undefined,
        estimatedCompletionDate: state.estimatedCompletionDate ? new Date(state.estimatedCompletionDate) : undefined,
      });

      void queryClient.invalidateQueries({ queryKey: trpc.arcRequest.list.queryKey() });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    }
  }, [state, createMutation, queryClient, trpc, router]);

  const canAdvance = step === 0
    ? state.modificationTypeId != null && state.propertyId != null
    : step === 1
      ? state.title.length > 0 && state.description.length > 0
      : step === 2
        ? true
        : step === 3;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProgressBar step={step} total={TOTAL_STEPS} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 ? (
          <StepSelectType
            groupedTypes={groupedTypes}
            selectedTypeId={state.modificationTypeId}
            onSelectType={(id, name, tier, docs) =>
              setState((s) => ({
                ...s,
                modificationTypeId: id,
                modificationTypeName: name,
                complexityTier: tier,
                requiredDocuments: docs,
                title: s.title || name,
              }))
            }
            properties={filteredProperties}
            selectedPropertyId={state.propertyId}
            propertySearch={propertySearch}
            onPropertySearch={setPropertySearch}
            onSelectProperty={(id, label) =>
              setState((s) => ({ ...s, propertyId: id, propertyLabel: label }))
            }
          />
        ) : null}

        {step === 1 ? (
          <StepDetails
            title={state.title}
            description={state.description}
            estimatedCost={state.estimatedCost}
            estimatedStartDate={state.estimatedStartDate}
            estimatedCompletionDate={state.estimatedCompletionDate}
            requiredDocuments={state.requiredDocuments}
            onTitleChange={(v) => setState((s) => ({ ...s, title: v }))}
            onDescriptionChange={(v) => setState((s) => ({ ...s, description: v }))}
            onCostChange={(v) => setState((s) => ({ ...s, estimatedCost: v }))}
            onStartDateChange={(v) => setState((s) => ({ ...s, estimatedStartDate: v }))}
            onCompletionDateChange={(v) => setState((s) => ({ ...s, estimatedCompletionDate: v }))}
          />
        ) : null}

        {step === 2 ? (
          <StepPhotos
            photoUri={state.photoUri}
            onCamera={handlePickPhoto}
            onLibrary={handlePickFromLibrary}
          />
        ) : null}

        {step === 3 ? (
          <StepReview
            state={state}
            isSubmitting={createMutation.isPending}
            onSubmit={handleSubmit}
          />
        ) : null}
      </ScrollView>

      <View style={styles.navRow}>
        {step > 0 ? (
          <Button label="Back" variant="outline" onPress={() => setStep((s) => s - 1)} style={styles.navBtn} />
        ) : (
          <View style={styles.navBtn} />
        )}
        {step < TOTAL_STEPS - 1 ? (
          <Button
            label="Next"
            onPress={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            style={styles.navBtn}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Step Components ────────────────────────────────────────────────────

function ProgressBar({ step, total }: { readonly step: number; readonly total: number }): React.ReactNode {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
      ))}
    </View>
  );
}

function StepSelectType({
  groupedTypes,
  selectedTypeId,
  onSelectType,
  properties,
  selectedPropertyId,
  propertySearch,
  onPropertySearch,
  onSelectProperty,
}: {
  readonly groupedTypes: Record<number, ReadonlyArray<{
    id: string; name: string; complexityTier: number;
    requiredDocuments: string[] | null; defaultReviewDays: number;
  }>>;
  readonly selectedTypeId: string | null;
  readonly onSelectType: (id: string, name: string, tier: number, docs: string[]) => void;
  readonly properties: ReadonlyArray<{ id: string; addressLine1: string | null; lotNumber: string | null }>;
  readonly selectedPropertyId: string | null;
  readonly propertySearch: string;
  readonly onPropertySearch: (v: string) => void;
  readonly onSelectProperty: (id: string, label: string) => void;
}): React.ReactNode {
  return (
    <View>
      <Text variant="heading2" style={styles.stepTitle}>Modification Type</Text>
      <Text variant="caption" style={styles.stepSubtitle}>
        Select the type of modification you are requesting.
      </Text>

      {([1, 2, 3] as const).map((tier) => {
        const types = groupedTypes[tier] ?? [];
        if (types.length === 0) return null;
        return (
          <View key={tier} style={styles.tierGroup}>
            <Badge
              variant={tier === 1 ? 'success' : tier === 2 ? 'info' : 'warning'}
              label={`${COMPLEXITY_TIER_LABELS[tier]} (${tier === 1 ? '~14 days' : tier === 2 ? '~30 days' : '~45 days'})`}
            />
            {types.map((t) => {
              const isSelected = t.id === selectedTypeId;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onSelectType(t.id, t.name, t.complexityTier, t.requiredDocuments ?? [])}
                  style={[styles.selectionItem, isSelected && styles.selectionItemActive]}
                  accessibilityLabel={`Select modification type ${t.name}`}
                >
                  <View style={styles.typeItemContent}>
                    <Text variant={isSelected ? 'bodyBold' : 'body'}>{t.name}</Text>
                    <Text variant="small" color={colors.neutral.textTertiary}>
                      {t.defaultReviewDays} day review
                    </Text>
                  </View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={24} color={colors.primary.base} /> : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}

      <Text variant="heading2" style={[styles.stepTitle, styles.sectionGap]}>Property</Text>
      <Input
        label="Search"
        value={propertySearch}
        onChangeText={onPropertySearch}
        placeholder="Address or lot number..."
      />
      <ScrollView style={styles.selectionList} nestedScrollEnabled>
        {properties.map((p) => {
          const label = p.addressLine1 ?? `Lot ${p.lotNumber ?? p.id}`;
          const isSelected = p.id === selectedPropertyId;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelectProperty(p.id, label)}
              style={[styles.selectionItem, isSelected && styles.selectionItemActive]}
              accessibilityLabel={`Select property ${label}`}
            >
              <View>
                <Text variant={isSelected ? 'bodyBold' : 'body'}>{label}</Text>
                {p.lotNumber ? <Text variant="caption">Lot {p.lotNumber}</Text> : null}
              </View>
              {isSelected ? <Ionicons name="checkmark-circle" size={24} color={colors.primary.base} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StepDetails({
  title, description, estimatedCost, estimatedStartDate, estimatedCompletionDate,
  requiredDocuments,
  onTitleChange, onDescriptionChange, onCostChange, onStartDateChange, onCompletionDateChange,
}: {
  readonly title: string;
  readonly description: string;
  readonly estimatedCost: string;
  readonly estimatedStartDate: string;
  readonly estimatedCompletionDate: string;
  readonly requiredDocuments: readonly string[];
  readonly onTitleChange: (v: string) => void;
  readonly onDescriptionChange: (v: string) => void;
  readonly onCostChange: (v: string) => void;
  readonly onStartDateChange: (v: string) => void;
  readonly onCompletionDateChange: (v: string) => void;
}): React.ReactNode {
  return (
    <View>
      <Text variant="heading2" style={styles.stepTitle}>Project Details</Text>

      <Input label="Title" value={title} onChangeText={onTitleChange} placeholder="Brief project description..." />

      <View style={styles.fieldGap}>
        <Text variant="bodyBold" style={styles.fieldLabel}>Description</Text>
        <TextInput
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="Describe the modification in detail..."
          multiline
          numberOfLines={5}
          style={styles.textArea}
          accessibilityLabel="Project description"
        />
      </View>

      <View style={styles.fieldGap}>
        <Input
          label="Estimated Cost ($)"
          value={estimatedCost}
          onChangeText={onCostChange}
          placeholder="e.g., 5000"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.fieldGap}>
        <Input
          label="Estimated Start Date (YYYY-MM-DD)"
          value={estimatedStartDate}
          onChangeText={onStartDateChange}
          placeholder="e.g., 2026-05-01"
        />
      </View>

      <View style={styles.fieldGap}>
        <Input
          label="Estimated Completion Date (YYYY-MM-DD)"
          value={estimatedCompletionDate}
          onChangeText={onCompletionDateChange}
          placeholder="e.g., 2026-06-15"
        />
      </View>

      {requiredDocuments.length > 0 ? (
        <Card style={styles.docsCard}>
          <Text variant="bodyBold" style={styles.fieldLabel}>Required Documents</Text>
          {requiredDocuments.map((doc, i) => (
            <View key={i} style={styles.docRow}>
              <Ionicons name="document-outline" size={16} color={colors.neutral.textTertiary} />
              <Text variant="caption" style={styles.docText}>{doc}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

function StepPhotos({
  photoUri, onCamera, onLibrary,
}: {
  readonly photoUri: string | null;
  readonly onCamera: () => void;
  readonly onLibrary: () => void;
}): React.ReactNode {
  return (
    <View>
      <Text variant="heading2" style={styles.stepTitle}>Photos</Text>
      <Text variant="caption" style={styles.stepSubtitle}>
        Upload photos of the area where the modification will take place. This is optional but helps speed up review.
      </Text>
      {photoUri ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} accessibilityRole="image" accessibilityLabel="Modification area photo" />
          <Button label="Replace Photo" variant="outline" onPress={onCamera} style={styles.retakeBtn} />
        </View>
      ) : (
        <View style={styles.photoActions}>
          <Pressable style={styles.cameraButton} onPress={onCamera} accessibilityLabel="Take photo with camera">
            <Ionicons name="camera" size={48} color={colors.primary.base} />
            <Text variant="body" color={colors.primary.base}>Camera</Text>
          </Pressable>
          <Pressable style={styles.cameraButton} onPress={onLibrary} accessibilityLabel="Choose from photo library">
            <Ionicons name="images" size={48} color={colors.primary.base} />
            <Text variant="body" color={colors.primary.base}>Library</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function StepReview({
  state, isSubmitting, onSubmit,
}: {
  readonly state: WizardState;
  readonly isSubmitting: boolean;
  readonly onSubmit: () => void;
}): React.ReactNode {
  return (
    <View>
      <Text variant="heading2" style={styles.stepTitle}>Review & Submit</Text>
      <Card style={styles.reviewCard}>
        {state.photoUri ? (
          <Image source={{ uri: state.photoUri }} style={styles.reviewImage} accessibilityRole="image" accessibilityLabel="Project photo preview" />
        ) : null}
        <ReviewRow label="Modification Type" value={state.modificationTypeName || 'Not selected'} />
        <ReviewRow label="Tier" value={COMPLEXITY_TIER_LABELS[state.complexityTier] ?? 'Standard'} />
        <ReviewRow label="Property" value={state.propertyLabel || 'Not selected'} />
        <ReviewRow label="Title" value={state.title || 'Untitled'} />
        <ReviewRow label="Description" value={state.description || 'None'} />
        {state.estimatedCost ? (
          <ReviewRow label="Est. Cost" value={`$${parseFloat(state.estimatedCost).toLocaleString()}`} />
        ) : null}
        {state.estimatedStartDate ? (
          <ReviewRow label="Start Date" value={state.estimatedStartDate} />
        ) : null}
        {state.estimatedCompletionDate ? (
          <ReviewRow label="Completion" value={state.estimatedCompletionDate} />
        ) : null}
      </Card>
      <Button
        label={isSubmitting ? 'Submitting...' : 'Submit Request'}
        onPress={onSubmit}
        disabled={isSubmitting || !state.modificationTypeId || !state.title || !state.description || !state.propertyId}
        style={styles.submitBtn}
        accessibilityLabel="Submit ARC request"
      />
    </View>
  );
}

function ReviewRow({
  label, value,
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactNode {
  return (
    <View style={styles.reviewRow}>
      <Text variant="small">{label}</Text>
      <Text variant="bodyBold" style={styles.reviewValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.neutral.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary.base,
  },
  stepTitle: {
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    marginBottom: spacing.xl,
  },
  sectionGap: {
    marginTop: spacing.xxl,
  },
  tierGroup: {
    marginBottom: spacing.lg,
  },
  typeItemContent: {
    flex: 1,
  },
  selectionList: {
    marginTop: spacing.lg,
    maxHeight: 300,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    minHeight: 56,
  },
  selectionItemActive: {
    borderColor: colors.primary.base,
    backgroundColor: colors.primary.surface,
  },
  fieldGap: {
    marginTop: spacing.lg,
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
    minHeight: 120,
    textAlignVertical: 'top',
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.background,
  },
  docsCard: {
    marginTop: spacing.lg,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  docText: {
    flex: 1,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  cameraButton: {
    width: 140,
    height: 140,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary.surface,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
  },
  photoPreview: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral.surface,
  },
  retakeBtn: {
    marginTop: spacing.md,
  },
  reviewCard: {
    marginBottom: spacing.xl,
  },
  reviewImage: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral.surface,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
  },
  reviewValue: {
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.lg,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.neutral.background,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  navBtn: {
    minWidth: 100,
  },
});
