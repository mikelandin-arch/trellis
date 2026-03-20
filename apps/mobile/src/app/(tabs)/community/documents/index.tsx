import { useCallback, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../../lib/trpc';
import { colors, spacing, borderRadius, typography } from '../../../../lib/theme';
import { Text, Card, Badge, EmptyState, LoadingSkeleton } from '../../../../components/ui';
import { DOCUMENT_CATEGORY_LABELS } from '@repo/shared';
import type { DocumentCategory } from '@repo/shared';

const FILE_ICONS: Record<string, string> = {
  'application/pdf': 'document-text',
  'image/jpeg': 'image',
  'image/png': 'image',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
};

export default function DocumentsScreen(): React.ReactNode {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const listQuery = useQuery(
    trpc.document.list.queryOptions({ limit: 100 }),
  );

  const searchQuery = useQuery(
    trpc.document.search.queryOptions(
      { query: search, limit: 20 },
    ),
  );

  const isSearching = search.trim().length > 0;
  const activeQuery = isSearching ? searchQuery : listQuery;

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.document.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const documents = isSearching
    ? (searchQuery.data ?? [])
    : (listQuery.data?.items ?? []).map((item) => ({ ...item, rank: 0 }));

  if (listQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={colors.neutral.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents..."
              placeholderTextColor={colors.neutral.textTertiary}
              editable={false}
            />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} width="100%" height={72} borderRadius={12} style={styles.skeletonItem} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.neutral.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor={colors.neutral.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            accessibilityLabel="Search documents"
          />
        </View>
      </View>

      <FlashList
        data={documents}
        keyExtractor={(item) => item.id}
        estimatedItemSize={72}
        refreshControl={
          <RefreshControl
            refreshing={activeQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.base}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/community/documents/${item.id}`)}
            accessibilityLabel={`Document: ${item.title}`}
          >
            <Card style={styles.docCard}>
              <View style={styles.docRow}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={(FILE_ICONS[item.mimeType] ?? 'document-outline') as keyof typeof Ionicons.glyphMap}
                    size={24}
                    color={colors.primary.base}
                  />
                </View>
                <View style={styles.docInfo}>
                  <Text variant="bodyBold" numberOfLines={1}>{item.title}</Text>
                  <View style={styles.docMeta}>
                    <Badge
                      variant="neutral"
                      label={DOCUMENT_CATEGORY_LABELS[item.category as DocumentCategory] ?? item.category}
                    />
                    <Text variant="caption" color={colors.neutral.textTertiary}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.neutral.textTertiary} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title={isSearching ? 'No results' : 'No documents'}
            subtitle={
              isSearching
                ? `No documents match "${search}"`
                : 'Community documents will appear here'
            }
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.neutral.textPrimary,
    marginLeft: spacing.md,
    paddingVertical: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  docCard: {
    marginBottom: spacing.sm,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.lg,
  },
  skeletonItem: {
    marginBottom: spacing.sm,
  },
});
