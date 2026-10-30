function getDirectErrorHttpStatus(error: any) {
  return error?.response?.status
    || error?.status
    || error?.statusCode
}

function getNestedErrorHttpStatus(error: any) {
  return error?.data?.httpStatus
    || error?.shape?.data?.httpStatus
}

function getErrorHttpStatus(error: any) {
  return getDirectErrorHttpStatus(error) || getNestedErrorHttpStatus(error)
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

function hasNetworkErrorMessage(error: any): boolean {
  return error?.message === 'Network Error' || error?.code === 'ECONNABORTED'
}

export function isNetworkOrServerError(error: any): boolean {
  if (isBrowserOffline()) {
    return true
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }

  if (hasNetworkErrorMessage(error)) {
    return true
  }

  // Учитываем структуру ошибки tRPC (error.data.httpStatus или error.shape.data.httpStatus)
  const status = getErrorHttpStatus(error)

  // Если статус отсутствует или это серверная ошибка (500+) — считаем, что это сбой сети/сервера
  if (!status || status >= 500) {
    return true
  }

  // Иначе (например, 401, 403, 404) — это штатная ошибка API, продолжаем логику
  return false
}
