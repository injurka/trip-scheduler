export type ToastTypes = 'error' | 'success' | 'warn' | 'info'

export interface ToastMessage {
  id: string
  type: ToastTypes
  detail: string
  expire: number
  swipeToClose: boolean
  group?: string
}

export type ToastOptions = Omit<Partial<ToastMessage>, 'id' | 'detail'>

export interface ToastApi {
  add: (message: Omit<Partial<ToastMessage>, 'id'>) => string
  remove: (id: string) => void
  success: (detail: string, options?: ToastOptions) => string
  error: (detail: string, options?: ToastOptions) => string
  warn: (detail: string, options?: ToastOptions) => string
  info: (detail: string, options?: ToastOptions) => string
}
