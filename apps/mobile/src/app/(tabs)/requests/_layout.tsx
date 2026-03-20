import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function RequestsLayout(): React.ReactNode {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.neutral.background },
        headerTintColor: colors.primary.base,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        contentStyle: { backgroundColor: colors.neutral.surface },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Requests' }} />
      <Stack.Screen name="[id]" options={{ title: 'Request Detail' }} />
      <Stack.Screen
        name="new"
        options={{ title: 'New Request', presentation: 'modal' }}
      />
      <Stack.Screen
        name="review"
        options={{ title: 'Review Request', presentation: 'modal' }}
      />
    </Stack>
  );
}
