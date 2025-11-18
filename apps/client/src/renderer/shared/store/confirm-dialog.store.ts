export interface ConfirmDialogOptions {
  title: string
  description: string
  confirmText?: string // Текст кнопки подтверждения
  type?: 'default' | 'danger' // Тип диалога для стилизации
}

export interface ConfirmDialogState extends ConfirmDialogOptions {
  isOpen: boolean
  resolve: (value: boolean) => void
  reject: (reason?: any) => void
}

const defaultState: Omit<ConfirmDialogState, 'resolve' | 'reject'> = {
  isOpen: false,
  title: '',
  description: '',
  confirmText: 'Подтвердить',
  type: 'default',
}

export const useConfirmDialogStore = defineStore('confirmDialog', {
  state: (): ConfirmDialogState => ({
    ...defaultState,
    resolve: () => { },
    reject: () => { },
  }),

  actions: {
    open(options: ConfirmDialogOptions): Promise<boolean> {
      return new Promise((resolve, reject) => {
        // Устанавливаем все опции, включая новые
        this.isOpen = true
        this.title = options.title
        this.description = options.description
        this.confirmText = options.confirmText || 'Подтвердить'
        this.type = options.type || 'default'

        this.resolve = resolve
        this.reject = reject
      })
    },

    _confirm() {
      this.resolve(true)
      this.isOpen = false
      setTimeout(() => this.resetContent(), 300)
    },

    _cancel() {
      this.resolve(false)
      this.isOpen = false
      setTimeout(() => this.resetContent(), 300)
    },

    resetContent() {
      // Сбрасываем все состояние к значениям по умолчанию
      Object.assign(this, defaultState)
    },
  },
})
