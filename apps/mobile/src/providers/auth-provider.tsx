import { ClerkProvider, tokenCache } from '../lib/clerk';
import type { ReactNode } from 'react';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required. Add it to your .env file.',
  );
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      {children}
    </ClerkProvider>
  );
}
