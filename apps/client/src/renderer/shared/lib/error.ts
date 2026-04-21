export function isNetworkOrServerError(error: any): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }

  if (error?.message === 'Network Error' || error?.code === 'ECONNABORTED') {
    return true
  }

  const status = error?.response?.status || error?.status || error?.statusCode
  if (!status || status >= 500) {
    return true
  }

  return false
}
