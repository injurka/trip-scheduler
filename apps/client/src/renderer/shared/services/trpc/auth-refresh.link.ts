import type { TRPCLink } from '@trpc/client'
import type { AppRouter } from '~/shared/types/trpc'
import { observable } from '@trpc/server/observable'
import { isUnauthorizedError, refreshTokensIfNeeded } from './auth-token.service'

export const authRefreshLink: TRPCLink<AppRouter> = () => {
  return ({ op, next }) => {
    return observable((observer) => {
      let isSubscribed = true
      let activeSub: { unsubscribe: () => void } | null = null

      const execute = () => {
        activeSub = next(op).subscribe({
          next(result) {
            if (isSubscribed) {
              observer.next(result)
            }
          },
          error(err) {
            if (!isSubscribed)
              return

            // Не перехватываем сам запрос refresh во избежание бесконечного цикла
            if (op.path === 'user.refresh' || !isUnauthorizedError(err)) {
              observer.error(err)
              return
            }

            refreshTokensIfNeeded()
              .then((success) => {
                if (!isSubscribed)
                  return
                if (success) {
                  execute()
                }
                else {
                  observer.error(err)
                }
              })
              .catch(() => {
                if (isSubscribed) {
                  observer.error(err)
                }
              })
          },
          complete() {
            if (isSubscribed) {
              observer.complete()
            }
          },
        })
      }

      execute()

      return () => {
        isSubscribed = false
        if (activeSub) {
          activeSub.unsubscribe()
        }
      }
    })
  }
}
