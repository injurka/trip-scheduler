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
}

interface IErrorCallback {
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

/**
 * Фабрика для создания гибких обработчиков API ошибок.
 * @param options - Опции для кастомизации обработчика.
 */
export function createApiErrorHandler(options: IApiErrorHandlerOptions = {}) {
  const { add: addToast } = useToast()

  return (payload: IErrorCallback) => {
    const { error } = payload

    // Извлекаем статус-код из разных возможных полей для универсальности
    const statusCode = error?.data?.httpStatus
      || error?.shape?.data?.httpStatus
      || error?.statusCode
      ? +(error.data?.httpStatus || error.shape?.data?.httpStatus || error.statusCode!)
      : 0

    const trpcCode = error?.shape?.data?.code || error?.data?.code

    console.error('[API Error Handler]', error)

    // 1. Кастомный обработчик
    if (options.handlers?.custom) {
      const result = options.handlers.custom(error, addToast)
      if (result === false)
        return
    }

    // 2. Проверяем, есть ли кастомный обработчик для этого кода
    if (options.handlers && options.handlers[statusCode]) {
      const result = options.handlers[statusCode](error, addToast)
      if (result === false)
        return
    }

    // 3. Проверяем, нужно ли игнорировать эту ошибку
    if (options.ignoreCodes?.includes(statusCode))
      return

    // 4. Стандартная логика определения сообщения
    let description = 'Произошла неизвестная ошибка. Пожалуйста, попробуйте позже.'

    if (trpcCode === 'FORBIDDEN' || statusCode === 403) {
      description = error?.shape?.message || error?.message || 'У вас нет прав для выполнения этого действия.'
    }
    else {
      switch (statusCode) {
        case 401:
          description = 'Вы не авторизованы. Пожалуйста, войдите в систему.'
          break
        case 409:
          description = error?.shape?.message
            || error?.data?.description
            || error?.data?.message
            || 'Произошел конфликт данных.'
          break
        default:
          if (error?.shape?.message)
            description = error.shape.message
          else if (error?.data?.description)
            description = error.data.description
          else if (error?.data?.message)
            description = error.data.message
          else if (error?.message)
            description = error.message
          break
      }
    }

    // 5. Показываем toast-уведомление
    if (options.showToast ?? true)
      addToast({ type: 'error', detail: description, expire: 5000 })
  }
}
