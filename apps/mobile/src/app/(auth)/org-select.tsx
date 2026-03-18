import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useOrganizationList, useAuth } from '../../lib/clerk';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { Text, Button, EmptyState } from '../../components/ui';

export default function OrgSelectScreen(): React.ReactNode {
  const { signOut } = useAuth();
  const { userMemberships, isLoaded, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [activating, setActivating] = useState<string | null>(null);

  const memberships = userMemberships?.data ?? [];

  const handleSelect = useCallback(
    async (orgId: string) => {
      if (!setActive) return;
      setActivating(orgId);
      try {
        await setActive({ organization: orgId });
      } finally {
        setActivating(null);
      }
    },
    [setActive],
  );

  if (!isLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary.base} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="heading1" align="center">
          Select your community
        </Text>
        <Text variant="caption" align="center" style={styles.subtitle}>
          Choose which HOA you want to manage
        </Text>
      </View>

      {memberships.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No communities yet"
          subtitle="You are not a member of any community. Ask your HOA board to send you an invitation."
        />
      ) : (
        <FlashList
          data={memberships}
          keyExtractor={(item) => item.organization.id}
          contentContainerStyle={styles.listContent}
          onEndReached={() => {
            if (userMemberships?.hasNextPage) {
              void userMemberships.fetchNext();
            }
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => {
            const org = item.organization;
            const isActivating = activating === org.id;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.orgCard,
                  isActivating && styles.orgCardActive,
                  pressed && styles.orgCardPressed,
                ]}
                onPress={() => handleSelect(org.id)}
                disabled={isActivating}
                accessibilityLabel={`Select ${org.name}`}
                accessibilityRole="button"
              >
                <View style={styles.orgAvatar}>
                  <Text variant="heading3" color="#ffffff" style={styles.orgAvatarText}>
                    {org.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.orgInfo}>
                  <Text variant="bodyBold">{org.name}</Text>
                  {org.slug ? (
                    <Text variant="caption">{org.slug}</Text>
                  ) : null}
                </View>
                {isActivating ? (
                  <ActivityIndicator size="small" color={colors.primary.base} />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.neutral.textTertiary}
                  />
                )}
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Button
          label="Sign out"
          onPress={() => signOut()}
          variant="ghost"
          icon="log-out-outline"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.surface,
  },
  header: {
    paddingTop: 80,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.neutral.background,
  },
  subtitle: {
    marginTop: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral.background,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  orgCardActive: {
    borderColor: colors.primary.base,
    backgroundColor: colors.primary.surface,
  },
  orgCardPressed: {
    backgroundColor: colors.neutral.surface,
  },
  orgAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.base,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  orgAvatarText: {
    fontSize: 20,
    lineHeight: 24,
  },
  orgInfo: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.lg,
    backgroundColor: colors.neutral.surface,
  },
});
