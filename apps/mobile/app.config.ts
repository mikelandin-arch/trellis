import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Trellis HOA',
  slug: 'trellis-hoa',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'trellis',
  ios: {
    bundleIdentifier: 'com.trellishoa.app',
    supportsTablet: true,
    associatedDomains: ['applinks:trellishoa.com'],
  },
  android: {
    package: 'com.trellishoa.app',
    adaptiveIcon: {
      backgroundColor: '#ffffff',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'trellishoa.com', pathPrefix: '/auth' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Trellis HOA to access your camera for violation documentation.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow Trellis HOA to access your location for property identification.',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '', // Fill after running: eas init
    },
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
};

export default config;
