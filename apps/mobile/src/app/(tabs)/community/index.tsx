import { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing, borderRadius } from '../../../lib/theme';
import { Text, Card, Badge } from '../../../components/ui';
import {
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABELS,
} from '@repo/shared';
import type { CommunicationPriority } from '@repo/shared';

export default function CommunityHubScreen(): React.ReactNode {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const announcementsQuery = useQuery(
    trpc.communication.list.queryOptions({
      communicationType: ['announcement'],
      limit: 5,
    }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.communication.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const announcements = announcementsQuery.data?.items ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="heading1">Community</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={announcementsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.base}
          />
        }
      >
        <View style={styles.quickLinks}>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/community/announcements')}
            accessibilityLabel="View announcements"
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: colors.primary.surface }]}>
              <Ionicons name="megaphone-outline" size={24} color={colors.primary.base} />
            </View>
            <Text variant="bodyBold">Announcements</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/community/documents')}
            accessibilityLabel="View documents"
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: colors.success.surface }]}>
              <Ionicons name="document-text-outline" size={24} color={colors.success.base} />
            </View>
            <Text variant="bodyBold">Documents</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/community/directory')}
            accessibilityLabel="View directory"
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: colors.warning.surface }]}>
              <Ionicons name="people-outline" size={24} color={colors.warning.base} />
            </View>
            <Text variant="bodyBold">Directory</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="heading3">Recent Announcements</Text>
            <TouchableOpacity onPress={() => router.push('/community/announcements')}>
              <Text variant="body" color={colors.primary.base}>See All</Text>
            </TouchableOpacity>
          </View>

          {announcements.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.neutral.textSecondary}>
                No announcements yet.
              </Text>
            </Card>
          ) : (
            announcements.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(`/community/announcement/${item.id}`)}
                accessibilityLabel={`Announcement: ${item.subject}`}
              >
                <Card style={styles.announcementCard}>
                  <View style={styles.announcementHeader}>
                    <Text variant="bodyBold" style={styles.announcementTitle} numberOfLines={1}>
                      {item.subject}
                    </Text>
                    <Badge
                      variant={PRIORITY_BADGE_VARIANT[item.priority as CommunicationPriority]}
                      label={PRIORITY_LABELS[item.priority as CommunicationPriority]}
                    />
                  </View>
                  <Text variant="caption" color={colors.neutral.textTertiary}>
                    {item.sentAt
                      ? new Date(item.sentAt).toLocaleDateString()
                      : 'Draft'}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    minHeight: 56,
  },
  quickLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  announcementCard: {
    marginBottom: spacing.sm,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  announcementTitle: {
    flex: 1,
    marginRight: spacing.sm,
  },
});
