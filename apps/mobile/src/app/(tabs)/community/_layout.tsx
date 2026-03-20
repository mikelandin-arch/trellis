import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function CommunityLayout(): React.ReactNode {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.neutral.background },
        headerTintColor: colors.primary.base,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        contentStyle: { backgroundColor: colors.neutral.surface },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Community', headerShown: false }} />
      <Stack.Screen name="announcements" options={{ title: 'Announcements' }} />
      <Stack.Screen name="announcement/[id]" options={{ title: 'Announcement' }} />
      <Stack.Screen name="documents/index" options={{ title: 'Documents' }} />
      <Stack.Screen name="documents/[id]" options={{ title: 'Document' }} />
      <Stack.Screen name="directory" options={{ title: 'Directory' }} />
    </Stack>
  );
}
