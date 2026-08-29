import type { Component } from 'vue'
import { defineAsyncComponent, h } from 'vue'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
import { useToastStore } from '~/shared/store/toast.store'

interface LazyComponentOptions {
  showLoader?: boolean
  delay?: number
  timeout?: number
}

/**
 * Обертка для ленивой загрузки компонентов с автовосстановлением.
 * Обрабатывает сетевые сбои, ошибки версионирования чанков после деплоя
 * и отображает опциональный скелетон/лоадер.
 */
export function lazyComponent(
  loader: () => Promise<Component | { default: Component }>,
  options: LazyComponentOptions = {},
) {
  const { showLoader = false, delay = 200, timeout = 15000 } = options

  return defineAsyncComponent({
    loader: async () => {
      const module = await loader()
      return ('default' in module ? module.default : module) as Component
    },

    loadingComponent: showLoader
      ? () =>
          h(
            'div',
            {
              style:
              'display: flex; justify-content: center; align-items: center; padding: 24px; width: 100%; min-height: 100px;',
            },
            [h(KitSkeleton, { style: 'width: 100%; height: 100%; min-height: 80px; border-radius: 8px;' })],
          )
      : undefined,

    delay,
    timeout,

    onError(error, retry, fail, attempts) {
      const errorMessage = error?.message?.toLowerCase() || ''
      const isChunkLoadError
        = errorMessage.includes('fetch dynamically imported module')
          || errorMessage.includes('importing a module script failed')
          || errorMessage.includes('failed to fetch')
          || errorMessage.includes('loading chunk')

      if (isChunkLoadError) {
        // Защита от бесконечного цикла перезагрузок страницы
        const reloadCount = Number(sessionStorage.getItem('chunk_reload_count') || '0')
        if (reloadCount < 2) {
          sessionStorage.setItem('chunk_reload_count', String(reloadCount + 1))
          window.location.reload()
          return
        }
      }

      // Для временных сетевых ошибок — делаем до 3 повторных попыток
      if (attempts <= 3) {
        setTimeout(retry, 1000 * attempts)
      }
      else {
        try {
          const toast = useToastStore()
          toast.error('Ошибка загрузки компонента. Проверьте интернет-соединение.')
        }
        catch {
          // Игнорируем, если store недоступен
        }
        fail()
      }
    },
  })
}
