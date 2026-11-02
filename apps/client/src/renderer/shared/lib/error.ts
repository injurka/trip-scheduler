import { getErrorCode, getErrorMessage, getErrorStatus } from '@injurka/type-utils'

export function isNetworkOrServerError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return true

  if (error instanceof TypeError && error.message.includes('fetch'))
    return true

  if (getErrorMessage(error) === 'Network Error' || getErrorCode(error) === 'ECONNABORTED')
    return true

  const status = getErrorStatus(error)

  return status === undefined || status >= 500
}
