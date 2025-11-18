import { API_CACHE_RULES } from './model/types'

/**
 * Отправляет команду в Service Worker для очистки кеша по его имени.
 * @param cacheName Имя кеша для очистки.
 */
function clearCacheByName(cacheName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      console.warn('Service Worker не активен, очистка кеша пропущена.')
      resolve()
      return
    }

    const messageChannel = new MessageChannel()

    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'CACHE_CLEARED' && event.data.payload.success) {
        // eslint-disable-next-line no-console
        console.log(`Кеш "${cacheName}" успешно очищен.`)
        resolve()
      }
      else {
        console.error('Ошибка при очистке кеша из Service Worker:', event.data.payload)
        reject(new Error(event.data.payload?.message || 'Неизвестная ошибка очистки кеша'))
      }
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE',
      payload: { cacheName },
    }, [messageChannel.port2])
  })
}

/**
 * Очищает все кеши API, которые могут содержать пользовательские данные.
 * Эта функция должна вызываться при выходе пользователя из системы.
 */
export async function clearUserSpecificApiCaches() {
  const dynamicApiCaches = API_CACHE_RULES
    .filter(rule => rule.strategy !== 'CacheFirst')
    .map(rule => rule.cacheName)

  const cachesToClear = [...new Set(dynamicApiCaches)]

  // eslint-disable-next-line no-console
  console.log('Очистка кешей API при выходе:', cachesToClear)

  for (const cacheName of cachesToClear) {
    try {
      await clearCacheByName(cacheName)
    }
    catch (error) {
      console.error(`Не удалось очистить кеш "${cacheName}":`, error)
    }
  }
}
