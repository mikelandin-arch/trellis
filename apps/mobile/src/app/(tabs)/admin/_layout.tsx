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
      <Stack.Screen name="meetings/index" options={{ title: 'Meetings' }} />
      <Stack.Screen name="meetings/[id]" options={{ title: 'Meeting Detail' }} />
      <Stack.Screen
        name="meetings/new"
        options={{ title: 'Schedule Meeting', presentation: 'modal' }}
      />
      <Stack.Screen name="meetings/agenda" options={{ title: 'Agenda Editor' }} />
      <Stack.Screen name="communications/index" options={{ title: 'Communications' }} />
      <Stack.Screen
        name="communications/compose"
        options={{ title: 'Compose', presentation: 'modal' }}
      />
    </Stack>
  );
}
