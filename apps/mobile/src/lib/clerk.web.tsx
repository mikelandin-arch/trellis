import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const MOCK_ORG = {
  id: 'org_3B0ke05kRyhNKSjphKtcJyycHcd',
  name: 'Talasera HOA',
  slug: 'talasera-hoa',
  membersCount: 55,
  imageUrl: '',
  hasImage: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

const MOCK_MEMBERSHIP = {
  role: 'org:board_officer' as const,
  organization: MOCK_ORG,
};

interface MockAuthState {
  isSignedIn: boolean;
  isLoaded: boolean;
  orgId: string | null;
}

const MockAuthContext = createContext<MockAuthState>({
  isSignedIn: true,
  isLoaded: true,
  orgId: MOCK_ORG.id,
});

export function ClerkProvider({
  children,
}: {
  children: ReactNode;
  publishableKey?: string;
  tokenCache?: unknown;
}): ReactNode {
  return (
    <MockAuthContext.Provider
      value={{ isSignedIn: true, isLoaded: true, orgId: MOCK_ORG.id }}
    >
      {children}
    </MockAuthContext.Provider>
  );
}

export function useAuth(): {
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string;
  sessionId: string;
  orgId: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
} {
  const state = useContext(MockAuthContext);
  const getToken = useCallback(async () => 'mock-dev-token', []);
  const signOut = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log('[MockClerk] signOut called');
  }, []);

  return {
    isSignedIn: state.isSignedIn,
    isLoaded: state.isLoaded,
    userId: 'user_mock_dev',
    sessionId: 'sess_mock_dev',
    orgId: state.orgId,
    getToken,
    signOut,
  };
}

export function useOrganization(): {
  organization: typeof MOCK_ORG | null;
  membership: typeof MOCK_MEMBERSHIP | null;
  isLoaded: boolean;
} {
  const state = useContext(MockAuthContext);
  return {
    organization: state.orgId ? MOCK_ORG : null,
    membership: state.orgId ? MOCK_MEMBERSHIP : null,
    isLoaded: true,
  };
}

export function useOrganizationList(_opts?: unknown): {
  isLoaded: boolean;
  setActive: (params: { organization: string }) => Promise<void>;
  userMemberships: {
    data: Array<typeof MOCK_MEMBERSHIP>;
    hasNextPage: boolean;
    fetchNext: () => Promise<void>;
  };
} {
  const setActive = useCallback(
    async (_params: { organization: string }) => {
      // eslint-disable-next-line no-console
      console.log('[MockClerk] setActive called');
    },
    [],
  );

  const userMemberships = useMemo(
    () => ({
      data: [MOCK_MEMBERSHIP],
      hasNextPage: false,
      fetchNext: async () => {},
    }),
    [],
  );

  return { isLoaded: true, setActive, userMemberships };
}

export function useSignIn(): {
  signIn: {
    create: (params: { identifier: string }) => Promise<{
      supportedFirstFactors: Array<{
        strategy: string;
        emailAddressId: string;
      }>;
    }>;
    prepareFirstFactor: (params: {
      strategy: string;
      emailAddressId: string;
    }) => Promise<void>;
    attemptFirstFactor: (params: {
      strategy: string;
      code: string;
    }) => Promise<{ status: string; createdSessionId: string }>;
  };
  setActive: (params: { session: string }) => Promise<void>;
  isLoaded: boolean;
} {
  const [isLoaded] = useState(true);

  const signIn = useMemo(
    () => ({
      create: async (_params: { identifier: string }) => ({
        supportedFirstFactors: [
          { strategy: 'email_code', emailAddressId: 'mock_email' },
        ],
      }),
      prepareFirstFactor: async () => {},
      attemptFirstFactor: async () => ({
        status: 'complete' as const,
        createdSessionId: 'sess_mock',
      }),
    }),
    [],
  );

  const setActive = useCallback(async () => {}, []);

  return { signIn, setActive, isLoaded };
}

export function useSSO(): {
  startSSOFlow: (params: {
    strategy: string;
    redirectUrl?: string;
  }) => Promise<{
    createdSessionId: string | null;
    setActive: ((params: { session: string }) => Promise<void>) | null;
  }>;
} {
  const startSSOFlow = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log('[MockClerk] SSO flow not available on web mock');
    return { createdSessionId: null, setActive: null };
  }, []);

  return { startSSOFlow };
}

export function isClerkRuntimeError(
  _err: unknown,
): _err is { code: string } {
  return false;
}

export const tokenCache = undefined;
