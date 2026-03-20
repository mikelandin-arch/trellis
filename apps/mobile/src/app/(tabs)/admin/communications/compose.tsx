import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../../lib/theme';
import { Text, Button, Input, Card } from '../../../../components/ui';
import { COMMUNICATION_TYPE_LABELS } from '@repo/shared';
import type { CommunicationType, AudienceType, CommunicationPriority } from '@repo/shared';

const COMM_TYPES: CommunicationType[] = [
  'announcement', 'general', 'emergency',
  'meeting_notice', 'assessment_notice',
];

const AUDIENCE_OPTIONS: Array<{ value: AudienceType; label: string }> = [
  { value: 'all_members', label: 'All Members' },
  { value: 'board', label: 'Board Only' },
  { value: 'role_based', label: 'By Role' },
];

const PRIORITY_OPTIONS: Array<{ value: CommunicationPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'standard', label: 'Standard' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
];

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
  { value: 'in_app', label: 'In-App' },
] as const;

export default function ComposeScreen(): React.ReactNode {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [communicationType, setCommunicationType] = useState<CommunicationType>('announcement');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<CommunicationPriority>('standard');
  const [audienceType, setAudienceType] = useState<AudienceType>('all_members');
  const [channels, setChannels] = useState<string[]>(['email']);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const createMutation = useMutation(
    trpc.communication.create.mutationOptions({
      onSuccess: (data) => {
        if (!scheduleEnabled) {
          sendMutation.mutate({ id: data.id });
        } else {
          void queryClient.invalidateQueries({ queryKey: trpc.communication.list.queryKey() });
          router.back();
        }
      },
    }),
  );

  const sendMutation = useMutation(
    trpc.communication.send.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.communication.list.queryKey() });
        router.back();
      },
    }),
  );

  const toggleChannel = useCallback((channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (!subject.trim() || !body.trim() || channels.length === 0) return;

    createMutation.mutate({
      communicationType,
      subject: subject.trim(),
      body: body.trim(),
      priority,
      audienceType,
      channels: channels as Array<'email' | 'sms' | 'push' | 'in_app' | 'physical_mail' | 'certified_mail'>,
      scheduledAt: scheduleEnabled && scheduleDate ? new Date(scheduleDate) : undefined,
    });
  }, [communicationType, subject, body, priority, audienceType, channels, scheduleEnabled, scheduleDate, createMutation]);

  const isLoading = createMutation.isPending || sendMutation.isPending;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="heading2" style={styles.heading}>Compose</Text>

      <Card style={styles.section}>
        <Text variant="bodyBold" style={styles.label}>Type</Text>
        <View style={styles.optionGrid}>
          {COMM_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.optionChip, communicationType === type && styles.optionChipActive]}
              onPress={() => setCommunicationType(type)}
            >
              <Text
                variant="caption"
                color={communicationType === type ? colors.primary.base : colors.neutral.textSecondary}
              >
                {COMMUNICATION_TYPE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Input
        label="Subject"
        value={subject}
        onChangeText={setSubject}
        placeholder="Enter subject line"
        accessibilityLabel="Communication subject"
      />

      <Input
        label="Body"
        value={body}
        onChangeText={setBody}
        placeholder="Write your message..."
        multiline
        numberOfLines={6}
        accessibilityLabel="Communication body"
      />

      <Card style={styles.section}>
        <Text variant="bodyBold" style={styles.label}>Priority</Text>
        <View style={styles.optionGrid}>
          {PRIORITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionChip, priority === opt.value && styles.optionChipActive]}
              onPress={() => setPriority(opt.value)}
            >
              <Text
                variant="caption"
                color={priority === opt.value ? colors.primary.base : colors.neutral.textSecondary}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text variant="bodyBold" style={styles.label}>Audience</Text>
        <View style={styles.optionGrid}>
          {AUDIENCE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionChip, audienceType === opt.value && styles.optionChipActive]}
              onPress={() => setAudienceType(opt.value)}
            >
              <Text
                variant="caption"
                color={audienceType === opt.value ? colors.primary.base : colors.neutral.textSecondary}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text variant="bodyBold" style={styles.label}>Channels</Text>
        {CHANNEL_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={styles.channelRow}
            onPress={() => toggleChannel(opt.value)}
            accessibilityLabel={`Toggle ${opt.label} channel`}
          >
            <View style={[styles.checkbox, channels.includes(opt.value) && styles.checkboxActive]}>
              {channels.includes(opt.value) && (
                <Text variant="caption" color="#fff">✓</Text>
              )}
            </View>
            <Text variant="body">{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </Card>

      <View style={styles.scheduleRow}>
        <Text variant="body">Schedule for later</Text>
        <Switch
          value={scheduleEnabled}
          onValueChange={setScheduleEnabled}
          trackColor={{ false: colors.neutral.border, true: colors.primary.surface }}
          thumbColor={scheduleEnabled ? colors.primary.base : colors.neutral.textTertiary}
        />
      </View>

      {scheduleEnabled && (
        <Input
          label="Schedule Date (YYYY-MM-DD)"
          value={scheduleDate}
          onChangeText={setScheduleDate}
          placeholder="2026-04-01"
          accessibilityLabel="Schedule date"
        />
      )}

      <Button
        variant="primary"
        onPress={handleSubmit}
        loading={isLoading}
        style={styles.submitButton}
        accessibilityLabel={scheduleEnabled ? 'Schedule communication' : 'Send now'}
        label={scheduleEnabled ? 'Schedule' : 'Send Now'}
      />
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
  heading: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.sm,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.background,
  },
  optionChipActive: {
    borderColor: colors.primary.base,
    backgroundColor: colors.primary.surface,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary.base,
    borderColor: colors.primary.base,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
});
