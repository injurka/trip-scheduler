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

  // Учитываем структуру ошибки tRPC (error.data.httpStatus или error.shape.data.httpStatus)
  const status = error?.response?.status
    || error?.status
    || error?.statusCode
    || error?.data?.httpStatus
    || error?.shape?.data?.httpStatus

  // Если статус отсутствует или это серверная ошибка (500+) — считаем, что это сбой сети/сервера
  if (!status || status >= 500) {
    return true
  }

  // Иначе (например, 401, 403, 404) — это штатная ошибка API, продолжаем логику
  return false
}
