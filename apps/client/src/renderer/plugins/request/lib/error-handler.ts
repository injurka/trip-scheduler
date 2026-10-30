import type { ToastMessage } from '~/shared/types/models/toast'

/**
 * Гибкий интерфейс ошибки, совместимый с форматом ошибок от tRPC и другими возможными форматами.
 */
export interface IError {
  // Структура ошибки от tRPC
  shape?: {
    message: string
    data?: {
      httpStatus?: number
      code?: string
    }
  }
  // Поле data может содержать httpStatus напрямую
  data?: {
    httpStatus?: number
    code?: string
    // Поля для совместимости с другими форматами ошибок
    description?: string
    message?: string
  }
  // Поле для совместимости с простыми HTTP ошибками
  statusCode?: number
  // Общее сообщение об ошибке
  message?: string
  // Отформатированное сообщение об ошибке
  customMessage: string
}

export interface IErrorCallback {
  error: IError
}

export interface IApiErrorHandlerOptions {
  ignoreCodes?: number[]
  /**
   * Кастомные обработчики для определенных кодов.
   * Если обработчик вернет `false`, дальнейшая стандартная обработка (тост, редирект) не произойдет.
   * @param error - Объект ошибки
   * @returns `false` для отмены стандартного поведения, иначе `void` или `true`.
   */
  handlers?: {
    [statusCode: number]: (error: IError, showToast: (message: Omit<ToastMessage, 'id'>) => void) => void | boolean
    custom?: (error: IError, showToast: (message: Omit<ToastMessage, 'id'>) => void) => void | boolean
  }
  /** Показывать ли toast-уведомление. По умолчанию `true`. */
  showToast?: boolean
}

function getPrimaryStatusCode(error: IError): number | undefined {
  return error?.data?.httpStatus || error?.shape?.data?.httpStatus
}

function getStatusCode(error: IError): number {
  const statusCode = getPrimaryStatusCode(error) || error?.statusCode

  return statusCode ? +statusCode : 0
}

function getTrpcCode(error: IError): string | undefined {
  return error?.shape?.data?.code || error?.data?.code
}

function getShapeMessage(error: IError): string | undefined {
  return error.shape?.message
}

function getErrorMessage(error: IError): string | undefined {
  return error.message
}

function getDataDescription(error: IError): string | undefined {
  return error.data?.description
}

function getDataMessage(error: IError): string | undefined {
  return error.data?.message
}

function getKnownErrorDescription(error: IError, statusCode: number, trpcCode?: string): string | undefined {
  if (trpcCode === 'FORBIDDEN' || statusCode === 403)
    return getShapeMessage(error) || getErrorMessage(error) || 'У вас нет прав для выполнения этого действия.'

  if (statusCode === 401)
    return 'Вы не авторизованы. Пожалуйста, войдите в систему.'

  if (statusCode === 409) {
    return getShapeMessage(error)
      || getDataDescription(error)
      || getDataMessage(error)
      || 'Произошел конфликт данных.'
  }

  return undefined
}

function getUnknownErrorDescription(error: IError): string {
  try {
    return JSON.parse(error.shape!.message!)[0].message
  }
  catch {
    return 'Произошла неизвестная ошибка. Пожалуйста, попробуйте позже.'
  }
}

function shouldStopErrorHandling(
  error: IError,
  statusCode: number,
  options: IApiErrorHandlerOptions,
  addToast: (message: Omit<ToastMessage, 'id'>) => void,
): boolean {
  const customHandler = options.handlers?.custom

  if (customHandler?.(error, addToast) === false)
    return true

  const statusHandler = options.handlers?.[statusCode]

  if (statusHandler?.(error, addToast) === false)
    return true

  return options.ignoreCodes?.includes(statusCode) ?? false
}

function handleApiError(error: IError, options: IApiErrorHandlerOptions, addToast: (message: Omit<ToastMessage, 'id'>) => void): void {
  const statusCode = getStatusCode(error)
  const trpcCode = getTrpcCode(error)

  console.error('[API Error Handler]', error)

  if (shouldStopErrorHandling(
    error,
    statusCode,
    options,
    addToast,
  )) {
    return
  }

  const description = getKnownErrorDescription(error, statusCode, trpcCode)
    || getUnknownErrorDescription(error)

  if (options.showToast ?? true)
    addToast({ type: 'error', detail: description, expire: 5000, swipeToClose: true })
}

/**
 * Фабрика для создания гибких обработчиков API ошибок.
 * @param options - Опции для кастомизации обработчика.
 */
export function createApiErrorHandler(options: IApiErrorHandlerOptions = {}) {
  const { add: addToast } = useToast()

  return (payload: IErrorCallback) => handleApiError(payload.error, options, addToast)
}
