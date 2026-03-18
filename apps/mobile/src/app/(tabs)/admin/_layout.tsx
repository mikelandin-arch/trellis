import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function AdminLayout(): React.ReactNode {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.neutral.background },
        headerTintColor: colors.primary.base,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        contentStyle: { backgroundColor: colors.neutral.surface },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin', headerShown: false }} />
      <Stack.Screen name="finance/index" options={{ title: 'Finance' }} />
      <Stack.Screen name="violations/index" options={{ title: 'Violations' }} />
      <Stack.Screen name="violations/[id]" options={{ title: 'Violation Detail' }} />
      <Stack.Screen
        name="violations/report"
        options={{ title: 'Report Violation', presentation: 'modal' }}
      />
      <Stack.Screen
        name="violations/transition"
        options={{ title: 'Update Status', presentation: 'modal' }}
      />
    </Stack>
  );
}
