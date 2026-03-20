import { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing } from '../../../../lib/theme';
import { Text, Card, Badge, Button, LoadingSkeleton } from '../../../../components/ui';
import { DOCUMENT_CATEGORY_LABELS } from '@repo/shared';
import type { DocumentCategory } from '@repo/shared';

function formatBytes(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(
    trpc.document.getById.queryOptions({ id }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.document.getById.queryKey({ id }),
    });
  }, [queryClient, trpc, id]);

  const handleDownload = useCallback(async () => {
    const doc = query.data;
    if (doc?.downloadUrl) {
      await Linking.openURL(doc.downloadUrl);
    }
  }, [query.data]);

  if (query.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSkeleton width="80%" height={28} borderRadius={4} />
          <LoadingSkeleton width="100%" height={150} borderRadius={12} style={styles.loadingGap} />
        </View>
      </View>
    );
  }

  const doc = query.data;
  if (!doc) return null;

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
      <Text variant="heading2" style={styles.title}>{doc.title}</Text>

      <View style={styles.badges}>
        <Badge
          variant="info"
          label={DOCUMENT_CATEGORY_LABELS[doc.category as DocumentCategory] ?? doc.category}
        />
        <Badge variant="neutral" label={`v${doc.version}`} />
      </View>

      {doc.description ? (
        <Text variant="body" color={colors.neutral.textSecondary} style={styles.description}>
          {doc.description}
        </Text>
      ) : null}

      <Card style={styles.metaCard}>
        <MetaItem label="File Type" value={doc.mimeType} />
        <MetaItem label="File Size" value={formatBytes(doc.fileSizeBytes)} />
        <MetaItem label="Uploaded" value={new Date(doc.createdAt).toLocaleDateString()} />
        <MetaItem label="Last Updated" value={new Date(doc.updatedAt).toLocaleDateString()} />
      </Card>

      <Button
        variant="primary"
        onPress={handleDownload}
        icon="download-outline"
        accessibilityLabel="Download document"
        label="Download"
      />

      {doc.versions && doc.versions.length > 0 && (
        <View style={styles.versionSection}>
          <Text variant="heading3" style={styles.versionTitle}>Version History</Text>
          {doc.versions.map((version) => (
            <Card key={version.id} style={styles.versionCard}>
              <View style={styles.versionRow}>
                <Text variant="bodyBold">Version {version.version}</Text>
                <Text variant="caption" color={colors.neutral.textTertiary}>
                  {new Date(version.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {version.changeSummary ? (
                <Text variant="caption" color={colors.neutral.textSecondary}>
                  {version.changeSummary}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function MetaItem({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <View style={styles.metaItem}>
      <Text variant="caption" color={colors.neutral.textTertiary}>{label}</Text>
      <Text variant="body">{value}</Text>
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
  title: {
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  description: {
    marginBottom: spacing.lg,
  },
  metaCard: {
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  versionSection: {
    marginTop: spacing.xl,
  },
  versionTitle: {
    marginBottom: spacing.md,
  },
  versionCard: {
    marginBottom: spacing.sm,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  loadingGap: {
    marginTop: spacing.md,
  },
});
