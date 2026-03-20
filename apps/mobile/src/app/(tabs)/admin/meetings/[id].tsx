import { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing } from '../../../../lib/theme';
import { Text, Card, Badge, Button, LoadingSkeleton } from '../../../../components/ui';
import {
  MEETING_STATUS_LABELS,
  MEETING_STATUS_BADGE_VARIANT,
  MEETING_TYPE_LABELS,
  AGENDA_ITEM_TYPE_LABELS,
  ATTENDANCE_TYPE_LABELS,
} from '@repo/shared';
import type { MeetingStatus, MeetingType, AgendaItemType, AttendanceType } from '@repo/shared';

export default function MeetingDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useQuery(
    trpc.meeting.getById.queryOptions({ id }),
  );

  const sendNoticeMutation = useMutation(
    trpc.meeting.sendNotice.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.meeting.getById.queryKey({ id }) });
      },
    }),
  );

  const cancelMutation = useMutation(
    trpc.meeting.cancel.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.meeting.getById.queryKey({ id }) });
      },
    }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.meeting.getById.queryKey({ id }),
    });
  }, [queryClient, trpc, id]);

  if (query.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSkeleton width="80%" height={28} borderRadius={4} />
          <LoadingSkeleton width="100%" height={200} borderRadius={12} style={styles.loadingGap} />
        </View>
      </View>
    );
  }

  const meeting = query.data;
  if (!meeting) return null;

  const quorumPercent = meeting.quorumRequired
    ? Math.min(((meeting.quorumPresent ?? 0) / meeting.quorumRequired) * 100, 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary.base}
        />
      }
    >
      <Text variant="heading2">{meeting.title}</Text>

      <View style={styles.badges}>
        <Badge
          variant={MEETING_STATUS_BADGE_VARIANT[meeting.status as MeetingStatus]}
          label={MEETING_STATUS_LABELS[meeting.status as MeetingStatus]}
        />
        <Badge
          variant="neutral"
          label={MEETING_TYPE_LABELS[meeting.meetingType as MeetingType]}
        />
      </View>

      <Card style={styles.detailCard}>
        <MetaRow icon="calendar-outline" label="Date" value={new Date(meeting.scheduledAt).toLocaleDateString()} />
        <MetaRow icon="time-outline" label="Time" value={new Date(meeting.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
        {meeting.location && <MetaRow icon="location-outline" label="Location" value={meeting.location} />}
        {meeting.virtualMeetingUrl && <MetaRow icon="videocam-outline" label="Virtual" value="Link available" />}
        {meeting.noticeSentAt && (
          <MetaRow icon="mail-outline" label="Notice Sent" value={new Date(meeting.noticeSentAt).toLocaleDateString()} />
        )}
      </Card>

      <Card style={styles.quorumCard}>
        <Text variant="bodyBold" style={styles.sectionTitle}>Quorum Status</Text>
        <View style={styles.quorumBar}>
          <View style={[styles.quorumFill, { width: `${quorumPercent}%` as `${number}%` }]} />
        </View>
        <View style={styles.quorumLabels}>
          <Text variant="caption">
            {meeting.quorumPresent ?? 0} of {meeting.quorumRequired ?? '?'} required
          </Text>
          <Badge
            variant={meeting.quorumMet ? 'success' : 'warning'}
            label={meeting.quorumMet ? 'Quorum Met' : 'No Quorum'}
          />
        </View>
      </Card>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="heading3">Agenda</Text>
          <Button
            variant="outline"
            onPress={() => router.push({ pathname: '/admin/meetings/agenda', params: { meetingId: id } })}
            label="Edit Agenda"
          />
        </View>
        {meeting.agendaItems.length === 0 ? (
          <Text variant="body" color={colors.neutral.textTertiary}>No agenda items yet.</Text>
        ) : (
          meeting.agendaItems.map((item, index) => (
            <Card key={item.id} style={styles.agendaItem}>
              <View style={styles.agendaHeader}>
                <Text variant="caption" color={colors.neutral.textTertiary}>
                  {index + 1}.
                </Text>
                <Text variant="bodyBold" style={styles.agendaTitle}>{item.title}</Text>
                <Badge
                  variant="neutral"
                  label={AGENDA_ITEM_TYPE_LABELS[item.itemType as AgendaItemType]}
                />
              </View>
              {item.durationMinutes ? (
                <Text variant="caption" color={colors.neutral.textTertiary}>
                  {item.durationMinutes} min
                </Text>
              ) : null}
              {item.resolution ? (
                <Text variant="caption" color={colors.success.base}>
                  Resolution: {item.resolution}
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text variant="heading3" style={styles.sectionTitle}>
          Attendees ({meeting.attendees.length})
        </Text>
        {meeting.attendees.length === 0 ? (
          <Text variant="body" color={colors.neutral.textTertiary}>No attendees recorded yet.</Text>
        ) : (
          meeting.attendees.map((att) => (
            <View key={att.id} style={styles.attendeeRow}>
              <View style={styles.attendeeCircle}>
                <Ionicons name="person" size={16} color={colors.primary.base} />
              </View>
              <Text variant="body" style={styles.attendeeName}>Member</Text>
              <Badge
                variant="neutral"
                label={ATTENDANCE_TYPE_LABELS[att.attendanceType as AttendanceType]}
              />
            </View>
          ))
        )}
      </View>

      {meeting.status === 'scheduled' && (
        <View style={styles.actions}>
          {!meeting.noticeSentAt && (
            <Button
              variant="primary"
              onPress={() => sendNoticeMutation.mutate({ meetingId: id })}
              loading={sendNoticeMutation.isPending}
              icon="mail-outline"
              label="Send Notice"
            />
          )}
          <Button
            variant="outline"
            onPress={() => cancelMutation.mutate({ id })}
            loading={cancelMutation.isPending}
            icon="close-circle-outline"
            label="Cancel Meeting"
          />
        </View>
      )}
    </ScrollView>
  );
}

function MetaRow({ icon, label, value }: { icon: string; label: string; value: string }): React.ReactNode {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.neutral.textTertiary} />
      <Text variant="caption" color={colors.neutral.textTertiary} style={styles.metaLabel}>{label}</Text>
      <Text variant="body" style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  detailCard: {
    marginBottom: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  metaLabel: {
    marginLeft: spacing.sm,
    width: 80,
  },
  metaValue: {
    flex: 1,
  },
  quorumCard: {
    marginBottom: spacing.lg,
  },
  quorumBar: {
    height: 8,
    backgroundColor: colors.neutral.border,
    borderRadius: 4,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  quorumFill: {
    height: '100%',
    backgroundColor: colors.primary.base,
    borderRadius: 4,
  },
  quorumLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  agendaItem: {
    marginBottom: spacing.sm,
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  agendaTitle: {
    flex: 1,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  attendeeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  attendeeName: {
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  loadingGap: {
    marginTop: spacing.md,
  },
});
