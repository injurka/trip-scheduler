import type { AppRouter } from '~/shared/types/trpc'
import { createTRPCProxyClient, httpBatchLink, loggerLink } from '@trpc/client'
import { useAuthStore } from '~/shared/store/auth.store'

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    loggerLink({
      enabled: op =>
        (import.meta.env.NODE_ENV === 'development')
        || (op.direction === 'down' && op.result instanceof Error),
    }),
    httpBatchLink({
      url: `${import.meta.env.VITE_APP_SERVER_URL}/trpc`,
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
