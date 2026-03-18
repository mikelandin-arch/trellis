import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useAuth } from './clerk';
import type { AppRouter } from '@repo/api-client';
import type { ReactNode } from 'react';

const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export { useTRPC };

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

const tokenStore: { getToken: (() => Promise<string | null>) | null } = {
  getToken: null,
};

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          const message = (error as { message?: string }).message ?? '';
          if (message.includes('UNAUTHORIZED') || message.includes('FORBIDDEN'))
            return false;
          return true;
        },
      },
    },
  });
}

function makeTrpcClient(): ReturnType<typeof createTRPCClient<AppRouter>> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        async headers() {
          const token = await tokenStore.getToken?.();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}

export function TRPCQueryProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
    tokenStore.getToken = getToken;
  }, [getToken]);

  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(makeTrpcClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
