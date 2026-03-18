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
import * as Location from 'expo-location';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../../lib/theme';
import { Text, Card, Button, Input, Badge } from '../../../../components/ui';
import { VIOLATION_SEVERITY_LABELS } from '@repo/shared';

const TOTAL_STEPS = 5;

interface WizardState {
  photoUri: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyId: string | null;
  propertyLabel: string;
  categoryId: string | null;
  categoryLabel: string;
  severity: string;
  title: string;
  description: string;
}

const INITIAL_STATE: WizardState = {
  photoUri: null,
  latitude: null,
  longitude: null,
  propertyId: null,
  propertyLabel: '',
  categoryId: null,
  categoryLabel: '',
  severity: 'minor',
  title: '',
  description: '',
};

export default function ReportViolationScreen(): React.ReactNode {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [propertySearch, setPropertySearch] = useState('');

  const propertyQuery = useQuery(trpc.property.list.queryOptions({ limit: 100 }));
  const categoryQuery = useQuery(trpc.violationCategory.list.queryOptions());

  const createMutation = useMutation(trpc.violation.create.mutationOptions());
  const addEvidenceMutation = useMutation(trpc.violation.addEvidence.mutationOptions());

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

  const categories = useMemo(
    () => (categoryQuery.data ?? []) as ReadonlyArray<{
      id: string; name: string; parentId: string | null;
      defaultSeverity: string; defaultCureDays: number;
    }>,
    [categoryQuery.data],
  );

  const parentCategories = useMemo(
    () => categories.filter((c) => c.parentId == null),
    [categories],
  );

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setState((s) => ({ ...s, photoUri: result.assets[0]!.uri }));
    }

    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setState((s) => ({
          ...s,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }));
      }
    } catch {
      /* GPS is best-effort */
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
    if (!state.propertyId || !state.title) return;

    try {
      const violation = await createMutation.mutateAsync({
        propertyId: state.propertyId,
        categoryId: state.categoryId ?? undefined,
        title: state.title,
        description: state.description || undefined,
        severity: state.severity as 'minor' | 'moderate' | 'major' | 'health_safety',
        source: 'board_inspection',
        latitude: state.latitude ?? undefined,
        longitude: state.longitude ?? undefined,
      });

      if (state.photoUri) {
        const evidence = await addEvidenceMutation.mutateAsync({
          violationId: violation.id,
          evidenceType: 'photo',
          latitude: state.latitude ?? undefined,
          longitude: state.longitude ?? undefined,
        });

        await uploadPhoto(state.photoUri, evidence.uploadUrl);
      }

      void queryClient.invalidateQueries({ queryKey: trpc.violation.list.queryKey() });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to submit violation. Please try again.');
    }
  }, [state, createMutation, addEvidenceMutation, queryClient, trpc, router]);

  const canAdvance = step === 0
    || (step === 1 && state.propertyId != null)
    || (step === 2)
    || (step === 3 && state.title.length > 0)
    || step === 4;

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
          <StepPhoto
            photoUri={state.photoUri}
            onCamera={handlePickPhoto}
            onLibrary={handlePickFromLibrary}
            hasGps={state.latitude != null}
          />
        ) : null}

        {step === 1 ? (
          <StepProperty
            properties={filteredProperties}
            selectedId={state.propertyId}
            search={propertySearch}
            onSearch={setPropertySearch}
            onSelect={(id, label) => setState((s) => ({ ...s, propertyId: id, propertyLabel: label }))}
          />
        ) : null}

        {step === 2 ? (
          <StepCategory
            categories={parentCategories}
            selectedId={state.categoryId}
            onSelect={(id, label, severity) =>
              setState((s) => ({
                ...s,
                categoryId: id,
                categoryLabel: label,
                severity,
                title: s.title || label,
              }))
            }
          />
        ) : null}

        {step === 3 ? (
          <StepDetails
            title={state.title}
            description={state.description}
            severity={state.severity}
            onTitleChange={(v) => setState((s) => ({ ...s, title: v }))}
            onDescriptionChange={(v) => setState((s) => ({ ...s, description: v }))}
            onSeverityChange={(v) => setState((s) => ({ ...s, severity: v }))}
          />
        ) : null}

        {step === 4 ? (
          <StepReview state={state} isSubmitting={createMutation.isPending} onSubmit={handleSubmit} />
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
            label={step === 0 && !state.photoUri ? 'Skip Photo' : 'Next'}
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

function StepPhoto({
  photoUri, onCamera, onLibrary, hasGps,
}: {
  readonly photoUri: string | null;
  readonly onCamera: () => void;
  readonly onLibrary: () => void;
  readonly hasGps: boolean;
}): React.ReactNode {
  return (
    <View>
      <Text variant="heading2" style={styles.stepTitle}>Capture Photo</Text>
      <Text variant="caption" style={styles.stepSubtitle}>
        Take a photo of the violation. GPS coordinates are captured automatically.
      </Text>
      {photoUri ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} accessibilityRole="image" accessibilityLabel="Violation photo" />
          {hasGps ? (
            <View style={styles.gpsIndicator}>
              <Ionicons name="location" size={14} color={colors.success.base} />
              <Text variant="small" color={colors.success.base}> GPS captured</Text>
            </View>
          ) : null}
          <Button label="Retake" variant="outline" onPress={onCamera} style={styles.retakeBtn} />
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

function StepProperty({
  properties, selectedId, search, onSearch, onSelect,
}: {
  readonly properties: ReadonlyArray<{ id: string; addressLine1: string | null; lotNumber: string | null }>;
  readonly selectedId: string | null;
  readonly search: string;
  readonly onSearch: (v: string) => void;
  readonly onSelect: (id: string, label: string) => void;
}): React.ReactNode {
  return (
    <View>
      <Text variant="heading2" style={styles.stepTitle}>Select Property</Text>
      <Input
        label="Search"
        value={search}
        onChangeText={onSearch}
        placeholder="Address or lot number..."
      />
      <ScrollView style={styles.selectionList}>
        {properties.map((p) => {
          const label = p.addressLine1 ?? `Lot ${p.lotNumber ?? p.id}`;
          const isSelected = p.id === selectedId;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p.id, label)}
              style={[styles.selectionItem, isSelected && styles.selectionItemActive]}
              accessibilityLabel={`Select property ${label}`}
            >
              <Text variant={isSelected ? 'bodyBold' : 'body'}>{label}</Text>
              {p.lotNumber ? <Text variant="caption">Lot {p.lotNumber}</Text> : null}
              {isSelected ? <Ionicons name="checkmark-circle" size={24} color={colors.primary.base} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StepCategory({
  categories, selectedId, onSelect,
}: {
  readonly categories: ReadonlyArray<{ id: string; name: string; defaultSeverity: string }>;
  readonly selectedId: string | null;
  readonly onSelect: (id: string, label: string, severity: string) => void;
}): React.ReactNode {
  return (
    <View>
      <Text variant="heading2" style={styles.stepTitle}>Select Category</Text>
      <Text variant="caption" style={styles.stepSubtitle}>Optional — you can skip this step.</Text>
      <ScrollView style={styles.selectionList}>
        {categories.map((c) => {
          const isSelected = c.id === selectedId;
          return (
            <Pressable
              key={c.id}
              onPress={() => onSelect(c.id, c.name, c.defaultSeverity)}
              style={[styles.selectionItem, isSelected && styles.selectionItemActive]}
              accessibilityLabel={`Select category ${c.name}`}
            >
              <Text variant={isSelected ? 'bodyBold' : 'body'}>{c.name}</Text>
              {isSelected ? <Ionicons name="checkmark-circle" size={24} color={colors.primary.base} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StepDetails({
  title, description, severity,
  onTitleChange, onDescriptionChange, onSeverityChange,
}: {
  readonly title: string;
  readonly description: string;
  readonly severity: string;
  readonly onTitleChange: (v: string) => void;
  readonly onDescriptionChange: (v: string) => void;
  readonly onSeverityChange: (v: string) => void;
}): React.ReactNode {
  const severityOptions = ['minor', 'moderate', 'major', 'health_safety'] as const;

  return (
    <View>
      <Text variant="heading2" style={styles.stepTitle}>Details</Text>
      <Input label="Title" value={title} onChangeText={onTitleChange} placeholder="Brief description..." />
      <View style={styles.fieldGap}>
        <Text variant="bodyBold" style={styles.fieldLabel}>Description (optional)</Text>
        <TextInput
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="Additional details..."
          multiline
          numberOfLines={4}
          style={styles.textArea}
          accessibilityLabel="Violation description"
        />
      </View>
      <View style={styles.fieldGap}>
        <Text variant="bodyBold" style={styles.fieldLabel}>Severity</Text>
        <View style={styles.severityRow}>
          {severityOptions.map((s) => (
            <Pressable
              key={s}
              onPress={() => onSeverityChange(s)}
              style={[styles.severityChip, severity === s && styles.severityChipActive]}
              accessibilityLabel={`Set severity to ${s}`}
            >
              <Text
                variant="small"
                color={severity === s ? colors.neutral.background : colors.neutral.textSecondary}
                style={styles.severityChipText}
              >
                {VIOLATION_SEVERITY_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
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
          <Image source={{ uri: state.photoUri }} style={styles.reviewImage} accessibilityRole="image" accessibilityLabel="Violation photo preview" />
        ) : null}
        <View style={styles.reviewRow}>
          <Text variant="small">Property</Text>
          <Text variant="bodyBold">{state.propertyLabel || 'Not selected'}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text variant="small">Category</Text>
          <Text variant="bodyBold">{state.categoryLabel || 'None'}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text variant="small">Title</Text>
          <Text variant="bodyBold">{state.title || 'Untitled'}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text variant="small">Severity</Text>
          <Badge
            variant={state.severity === 'health_safety' || state.severity === 'major' ? 'error' : state.severity === 'moderate' ? 'warning' : 'info'}
            label={VIOLATION_SEVERITY_LABELS[state.severity as keyof typeof VIOLATION_SEVERITY_LABELS] ?? state.severity}
          />
        </View>
        {state.latitude != null ? (
          <View style={styles.reviewRow}>
            <Text variant="small">GPS</Text>
            <Text variant="caption">{state.latitude.toFixed(5)}, {state.longitude?.toFixed(5)}</Text>
          </View>
        ) : null}
      </Card>
      <Button
        label={isSubmitting ? 'Submitting...' : 'Submit Violation'}
        onPress={onSubmit}
        disabled={isSubmitting || !state.propertyId || !state.title}
        style={styles.submitBtn}
        accessibilityLabel="Submit violation report"
      />
    </View>
  );
}

// ── Upload helper ──────────────────────────────────────────────────────

async function uploadPhoto(uri: string, uploadUrl: string): Promise<void> {
  const response = await fetch(uri);
  const blob = await response.blob();
  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
  });
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
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  retakeBtn: {
    marginTop: spacing.md,
  },
  selectionList: {
    marginTop: spacing.lg,
    maxHeight: 400,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
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
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.background,
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  severityChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.surface,
    minHeight: 40,
    justifyContent: 'center',
  },
  severityChipActive: {
    backgroundColor: colors.primary.base,
  },
  severityChipText: {
    fontWeight: '600',
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
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.surface,
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
