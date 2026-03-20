import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing } from '../../../../lib/theme';
import { Text, Button, Input, Card } from '../../../../components/ui';
import { MEETING_TYPE_LABELS } from '@repo/shared';
import type { MeetingType } from '@repo/shared';

const MEETING_TYPES: MeetingType[] = ['board', 'annual', 'special', 'committee', 'executive_session'];

export default function NewMeetingScreen(): React.ReactNode {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('board');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [virtualUrl, setVirtualUrl] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [isHybrid, setIsHybrid] = useState(false);

  const createMutation = useMutation(
    trpc.meeting.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.meeting.list.queryKey() });
        router.back();
      },
    }),
  );

  const handleSubmit = useCallback(() => {
    if (!title.trim() || !date.trim()) return;

    const scheduledAt = new Date(`${date}T${time || '18:00'}`);

    createMutation.mutate({
      meetingType,
      title: title.trim(),
      scheduledAt,
      location: location.trim() || undefined,
      virtualMeetingUrl: virtualUrl.trim() || undefined,
      isVirtual,
      isHybrid,
    });
  }, [title, meetingType, date, time, location, virtualUrl, isVirtual, isHybrid, createMutation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="heading2" style={styles.heading}>Schedule Meeting</Text>

      <Card style={styles.section}>
        <Text variant="bodyBold" style={styles.label}>Meeting Type</Text>
        <View style={styles.typeGrid}>
          {MEETING_TYPES.map((type) => (
            <Button
              key={type}
              variant={meetingType === type ? 'primary' : 'outline'}
              onPress={() => setMeetingType(type)}
              label={MEETING_TYPE_LABELS[type]}
            />
          ))}
        </View>
      </Card>

      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. March Board Meeting"
        accessibilityLabel="Meeting title"
      />

      <Input
        label="Date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        placeholder="2026-04-15"
        accessibilityLabel="Meeting date"
      />

      <Input
        label="Time (HH:MM)"
        value={time}
        onChangeText={setTime}
        placeholder="18:00"
        accessibilityLabel="Meeting time"
      />

      <Input
        label="Location"
        value={location}
        onChangeText={setLocation}
        placeholder="Clubhouse, 12000 Talasera Ln"
        accessibilityLabel="Meeting location"
      />

      <Input
        label="Virtual Meeting URL"
        value={virtualUrl}
        onChangeText={setVirtualUrl}
        placeholder="https://zoom.us/j/..."
        accessibilityLabel="Virtual meeting URL"
      />

      <View style={styles.switchRow}>
        <Text variant="body">Virtual Only</Text>
        <Switch
          value={isVirtual}
          onValueChange={setIsVirtual}
          trackColor={{ false: colors.neutral.border, true: colors.primary.surface }}
          thumbColor={isVirtual ? colors.primary.base : colors.neutral.textTertiary}
        />
      </View>

      <View style={styles.switchRow}>
        <Text variant="body">Hybrid (In-person + Virtual)</Text>
        <Switch
          value={isHybrid}
          onValueChange={setIsHybrid}
          trackColor={{ false: colors.neutral.border, true: colors.primary.surface }}
          thumbColor={isHybrid ? colors.primary.base : colors.neutral.textTertiary}
        />
      </View>

      <Button
        variant="primary"
        onPress={handleSubmit}
        loading={createMutation.isPending}
        style={styles.submitButton}
        accessibilityLabel="Create meeting"
        label="Create Meeting"
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  submitButton: {
    marginTop: spacing.xl,
  },
});
