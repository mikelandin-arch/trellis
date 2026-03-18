import { Tabs } from 'expo-router';
import { useOrganization } from '../../lib/clerk';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { CLERK_ROLES } from '@repo/shared';
import { colors, spacing } from '../../lib/theme';

const ADMIN_ROLES: ReadonlySet<string> = new Set([
  CLERK_ROLES.SUPER_ADMIN,
  CLERK_ROLES.BOARD_OFFICER,
  CLERK_ROLES.BOARD_MEMBER,
  CLERK_ROLES.PROPERTY_MANAGER,
]);

export default function TabLayout(): React.ReactNode {
  const { membership } = useOrganization();
  const role = membership?.role;
  const isAdmin = role != null && ADMIN_ROLES.has(role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.base,
        tabBarInactiveTintColor: colors.neutral.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'card' : 'card-outline'}
              size={24}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'Payments',
        }}
      />
      <Tabs.Screen
        name="community/index"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={24}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'Community',
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={24}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'Requests',
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/admin' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-outline'}
              size={24}
              color={color}
            />
          ),
          tabBarAccessibilityLabel: 'Admin',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    minHeight: 64,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabBarItem: {
    minHeight: 56,
  },
});
