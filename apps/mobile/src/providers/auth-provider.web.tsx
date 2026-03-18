import { ClerkProvider } from '../lib/clerk';
import type { ReactNode } from 'react';

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <ClerkProvider>{children}</ClerkProvider>;
}
