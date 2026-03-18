import { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '../../lib/clerk';
import { useTRPC } from '../../lib/trpc';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { Text, Card, Badge, LoadingSkeleton, EmptyState } from '../../components/ui';

function SummaryCard({
  icon,
  value,
  label,
  color,
}: {
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly value: string;
  readonly label: string;
  readonly color: string;
}): React.ReactNode {
  return (
    <View style={summaryStyles.card}>
      <View style={[summaryStyles.iconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text variant="heading2" style={summaryStyles.value}>{value}</Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  value: {
    marginBottom: spacing.xs,
  },
});

export default function HomeScreen(): React.ReactNode {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  const propertyQuery = useQuery(
    trpc.property.list.queryOptions({ limit: 100 }),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.property.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const properties = propertyQuery.data?.items ?? [];
  const isLoading = propertyQuery.isLoading;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={propertyQuery.isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary.base}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="caption">Welcome back</Text>
        <Text variant="heading1">
          {organization?.name ?? 'My Community'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.summaryRow}>
          <View style={summaryStyles.card}>
            <LoadingSkeleton width={48} height={48} borderRadius={24} />
            <LoadingSkeleton width={40} height={28} borderRadius={6} style={styles.skeletonGap} />
            <LoadingSkeleton width={70} height={16} borderRadius={4} />
          </View>
          <View style={styles.summaryGap} />
          <View style={summaryStyles.card}>
            <LoadingSkeleton width={48} height={48} borderRadius={24} />
            <LoadingSkeleton width={40} height={28} borderRadius={6} style={styles.skeletonGap} />
            <LoadingSkeleton width={70} height={16} borderRadius={4} />
          </View>
        </View>
      ) : (
        <View style={styles.summaryRow}>
          <SummaryCard
            icon="home"
            value={String(properties.length)}
            label="Properties"
            color={colors.primary.base}
          />
          <View style={styles.summaryGap} />
          <SummaryCard
            icon="people"
            value="-"
            label="Members"
            color={colors.success.base}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text variant="heading3" style={styles.sectionTitle}>
          Recent Activity
        </Text>
        <Card>
          <EmptyState
            icon="time-outline"
            title="No recent activity"
            subtitle="Activity from your community will appear here"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="heading3" style={styles.sectionTitle}>
          Properties
        </Text>
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <View key={i} style={styles.propertyCardSkeleton}>
                <LoadingSkeleton width="60%" height={20} borderRadius={6} />
                <LoadingSkeleton
                  width="40%"
                  height={16}
                  borderRadius={4}
                  style={styles.skeletonGap}
                />
              </View>
            ))
          : properties.length === 0
            ? (
                <EmptyState
                  icon="home-outline"
                  title="No properties"
                  subtitle="Properties will appear here once added to your community"
                />
              )
            : properties.slice(0, 5).map((item) => (
                <Card key={item.id} style={styles.propertyCard}>
                  <View style={styles.propertyRow}>
                    <View style={styles.propertyInfo}>
                      <Text variant="bodyBold">
                        {item.addressLine1 ?? `Lot ${item.lotNumber ?? item.id}`}
                      </Text>
                      {item.city ? (
                        <Text variant="caption">
                          {[item.city, item.stateCode, item.zip]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      ) : null}
                    </View>
                    {item.lotNumber != null && (
                      <Badge variant="info" label={`Lot ${item.lotNumber}`} />
                    )}
                  </View>
                </Card>
              ))}
        {!isLoading && properties.length > 5 && (
          <Text
            variant="bodyBold"
            align="center"
            color={colors.primary.base}
            style={styles.viewAll}
          >
            View all {properties.length} properties
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: colors.neutral.background,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  summaryGap: {
    width: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  propertyCard: {
    marginBottom: spacing.sm,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  propertyCardSkeleton: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  skeletonGap: {
    marginTop: spacing.sm,
  },
  viewAll: {
    paddingVertical: spacing.lg,
  },
});
