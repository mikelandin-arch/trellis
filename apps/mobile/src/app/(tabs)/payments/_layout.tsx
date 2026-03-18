import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function PaymentsLayout(): React.ReactNode {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.neutral.background },
        headerTintColor: colors.primary.base,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        contentStyle: { backgroundColor: colors.neutral.surface },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Payments' }} />
      <Stack.Screen name="pay" options={{ title: 'Make Payment', presentation: 'modal' }} />
      <Stack.Screen name="history" options={{ title: 'Payment History' }} />
    </Stack>
  );
}
