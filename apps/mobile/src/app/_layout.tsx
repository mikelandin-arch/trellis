import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuth, useOrganization } from '../lib/clerk';
import { AuthProvider } from '../providers/auth-provider';
import { TRPCQueryProvider } from '../lib/trpc';

function useProtectedRoute(): void {
  const { isSignedIn, isLoaded } = useAuth();
  const { organization } = useOrganization();
  const segments: string[] = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const secondSegment = segments[1];

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (isSignedIn && !organization && secondSegment !== 'org-select') {
      router.replace('/(auth)/org-select');
    } else if (isSignedIn && organization && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, isLoaded, organization, segments, router]);
}

function RootNavigator(): React.ReactNode {
  const { isLoaded } = useAuth();
  useProtectedRoute();

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout(): React.ReactNode {
  return (
    <AuthProvider>
      <TRPCQueryProvider>
        <RootNavigator />
      </TRPCQueryProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
