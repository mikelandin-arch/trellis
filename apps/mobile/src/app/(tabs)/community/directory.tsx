import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '../../../lib/trpc';
import { colors, spacing, borderRadius, typography } from '../../../lib/theme';
import { Text, EmptyState, LoadingSkeleton } from '../../../components/ui';

export default function DirectoryScreen(): React.ReactNode {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const propertyQuery = useQuery(
    trpc.property.list.queryOptions({ limit: 100 }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.property.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const allProperties = propertyQuery.data?.items ?? [];

  const properties = useMemo(() => {
    if (search.trim().length === 0) return allProperties;
    const term = search.toLowerCase();
    return allProperties.filter(
      (p) =>
        (p.addressLine1?.toLowerCase().includes(term) ?? false) ||
        String(p.lotNumber ?? '').includes(term) ||
        (p.city?.toLowerCase().includes(term) ?? false),
    );
  }, [allProperties, search]);

  if (propertyQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={colors.neutral.textTertiary} />
            <TextInput style={styles.searchInput} placeholder="Search properties..." editable={false} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <LoadingSkeleton width={48} height={48} borderRadius={24} />
              <View style={styles.skeletonText}>
                <LoadingSkeleton width="70%" height={18} borderRadius={4} />
                <LoadingSkeleton width="50%" height={14} borderRadius={4} style={styles.skeletonGap} />
              </View>
            </View>
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
            placeholder="Search properties..."
            placeholderTextColor={colors.neutral.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            accessibilityLabel="Search properties"
          />
        </View>
      </View>

      <FlashList
        data={properties}
        keyExtractor={(item) => String(item.id)}
        estimatedItemSize={72}
        refreshControl={
          <RefreshControl
            refreshing={propertyQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.base}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.propertyRow}>
            <View style={styles.lotCircle}>
              <Text variant="caption" color={colors.primary.dark} style={styles.lotText}>
                {item.lotNumber ?? '#'}
              </Text>
            </View>
            <View style={styles.propertyInfo}>
              <Text variant="bodyBold">
                {item.addressLine1 ?? `Property ${item.id}`}
              </Text>
              {item.city ? (
                <Text variant="caption">
                  {[item.city, item.stateCode, item.zip].filter(Boolean).join(', ')}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.neutral.textTertiary} />
          </View>
        )}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title={search ? 'No results' : 'No properties'}
            subtitle={
              search
                ? `No properties match "${search}"`
                : 'Properties will appear here once added'
            }
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function Separator(): React.ReactNode {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
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
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  lotCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  lotText: {
    fontWeight: '700',
    fontSize: 14,
  },
  propertyInfo: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginLeft: 64 + spacing.lg,
  },
  loadingContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  skeletonText: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  skeletonGap: {
    marginTop: spacing.sm,
  },
});
