import type { AppRouter } from '~/shared/types/trpc'
import { createTRPCProxyClient, httpBatchLink, loggerLink } from '@trpc/client'
import { SERVER_URL } from '~/shared/lib/env'
import { useAuthStore } from '~/shared/store/auth.store'
import { authRefreshLink } from './auth-refresh.link'

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    authRefreshLink,
    loggerLink({
      enabled: op =>
        (import.meta.env.NODE_ENV === 'development')
        || (op.direction === 'down' && op.result instanceof Error),
    }),
    httpBatchLink({
      url: `${SERVER_URL}/trpc`,
      async headers() {
        const authStore = useAuthStore()
        const token = authStore.tokenPair?.accessToken

        if (token) {
          return {
            Authorization: `Bearer ${token}`,
          }
        }

        return {}
      },
    }),
  ],
})
