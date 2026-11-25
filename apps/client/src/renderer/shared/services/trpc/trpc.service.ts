import type { AppRouter } from '~/shared/types/trpc'
import { createTRPCProxyClient, httpBatchLink, httpLink, loggerLink, splitLink } from '@trpc/client'
import { onlineFetch } from '~/shared/lib/connectivity'
import { SERVER_URL } from '~/shared/lib/env'
import { useAuthStore } from '~/shared/store/auth.store'
import { authRefreshLink } from './auth-refresh.link'

const httpOptions = {
  fetch: onlineFetch,
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
}

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    authRefreshLink,
    loggerLink({
      enabled: op =>
        (import.meta.env.NODE_ENV === 'development')
        || (op.direction === 'down' && op.result instanceof Error),
    }),
    splitLink({
      condition: op => op.path === 'tracking.getTripDaySummary'
        || op.path === 'tracking.getSummaries'
        || op.path === 'tracking.getDay'
        || op.path === 'tracking.getTripDay',
      true: httpLink(httpOptions),
      false: httpBatchLink(httpOptions),
    }),
  ],
})
