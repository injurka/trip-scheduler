import { getErrorCode, getErrorMessage, getErrorStatus } from '@injurka/type-utils'
import { isAppOnline } from '~/shared/lib/connectivity'

export function isNetworkOrServerError(error: unknown): boolean {
  if (!isAppOnline())
    return true

  if (error instanceof TypeError && error.message.includes('fetch'))
    return true

  if (getErrorMessage(error) === 'Network Error' || getErrorCode(error) === 'ECONNABORTED')
    return true

  const status = getErrorStatus(error)

  return status === undefined || status >= 500
}
