import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing } from '../../../../lib/theme';
import { Text, Card, Badge, Button, Input } from '../../../../components/ui';
import { AGENDA_ITEM_TYPE_LABELS } from '@repo/shared';
import type { AgendaItemType } from '@repo/shared';

export default function AgendaEditorScreen(): React.ReactNode {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState('');

  const agendaQuery = useQuery(
    trpc.agendaItem.list.queryOptions({ id: meetingId }),
  );

  const addMutation = useMutation(
    trpc.agendaItem.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.agendaItem.list.queryKey({ id: meetingId }) });
        setNewTitle('');
        setNewDuration('');
        setShowAdd(false);
      },
    }),
  );

  const reorderMutation = useMutation(
    trpc.agendaItem.reorder.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.agendaItem.list.queryKey({ id: meetingId }) });
      },
    }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.agendaItem.list.queryKey({ id: meetingId }),
    });
  }, [queryClient, trpc, meetingId]);

  const handleAdd = useCallback(() => {
    if (!newTitle.trim()) return;
    addMutation.mutate({
      meetingId,
      title: newTitle.trim(),
      durationMinutes: newDuration ? parseInt(newDuration, 10) : undefined,
      itemType: 'discussion',
    });
  }, [meetingId, newTitle, newDuration, addMutation]);

  const handleMoveUp = useCallback((index: number) => {
    const items = agendaQuery.data;
    if (!items || index === 0) return;

    const reordered = items.map((item, i) => ({
      id: item.id,
      sortOrder: i === index ? items[i - 1]!.sortOrder : i === index - 1 ? items[i + 1]!.sortOrder : item.sortOrder,
    }));

    reorderMutation.mutate({ meetingId, items: reordered });
  }, [agendaQuery.data, meetingId, reorderMutation]);

  const handleMoveDown = useCallback((index: number) => {
    const items = agendaQuery.data;
    if (!items || index >= items.length - 1) return;

    const reordered = items.map((item, i) => ({
      id: item.id,
      sortOrder: i === index ? items[i + 1]!.sortOrder : i === index + 1 ? items[i - 1]!.sortOrder : item.sortOrder,
    }));

    reorderMutation.mutate({ meetingId, items: reordered });
  }, [agendaQuery.data, meetingId, reorderMutation]);

  const agendaItems = agendaQuery.data ?? [];
  const totalMinutes = agendaItems.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={agendaQuery.isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary.base}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="heading3">Agenda Items</Text>
        <Text variant="caption" color={colors.neutral.textTertiary}>
          Total: {totalMinutes} min
        </Text>
      </View>

      {agendaItems.map((item, index) => (
        <Card key={item.id} style={styles.agendaCard}>
          <View style={styles.agendaRow}>
            <View style={styles.orderButtons}>
              <TouchableOpacity
                onPress={() => handleMoveUp(index)}
                disabled={index === 0}
                accessibilityLabel={`Move ${item.title} up`}
              >
                <Ionicons
                  name="chevron-up"
                  size={20}
                  color={index === 0 ? colors.neutral.border : colors.neutral.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleMoveDown(index)}
                disabled={index === agendaItems.length - 1}
                accessibilityLabel={`Move ${item.title} down`}
              >
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={index === agendaItems.length - 1 ? colors.neutral.border : colors.neutral.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.agendaInfo}>
              <Text variant="bodyBold">{item.title}</Text>
              <View style={styles.agendaMeta}>
                <Badge
                  variant="neutral"
                  label={AGENDA_ITEM_TYPE_LABELS[item.itemType as AgendaItemType]}
                />
                {item.durationMinutes ? (
                  <Text variant="caption" color={colors.neutral.textTertiary}>
                    {item.durationMinutes} min
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </Card>
      ))}

      {showAdd ? (
        <Card style={styles.addForm}>
          <Input
            label="Title"
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Agenda item title"
            accessibilityLabel="New agenda item title"
          />
          <Input
            label="Duration (minutes)"
            value={newDuration}
            onChangeText={setNewDuration}
            placeholder="15"
            keyboardType="numeric"
            accessibilityLabel="Duration in minutes"
          />
          <View style={styles.addActions}>
            <Button variant="outline" onPress={() => setShowAdd(false)} label="Cancel" />
            <Button
              variant="primary"
              onPress={handleAdd}
              loading={addMutation.isPending}
              label="Add"
            />
          </View>
        </Card>
      ) : (
        <Button
          variant="outline"
          onPress={() => setShowAdd(true)}
          icon="add-outline"
          style={styles.addButton}
          label="Add Agenda Item"
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  agendaCard: {
    marginBottom: spacing.sm,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderButtons: {
    marginRight: spacing.md,
    alignItems: 'center',
  },
  agendaInfo: {
    flex: 1,
  },
  agendaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addForm: {
    marginTop: spacing.md,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addButton: {
    marginTop: spacing.md,
  },
});
