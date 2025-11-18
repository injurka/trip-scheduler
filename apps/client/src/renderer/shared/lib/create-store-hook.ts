/**
 * Фабрика для создания типизированного хука `useStore`.
 * Этот хук позволяет централизованно управлять сторами.
 *
 * @param stores - Объект, где ключи - это псевдонимы, а значения - функции-создатели сторов (use...Store).
 * @returns - Хук `useStore`, который можно использовать внутри компонентов.
 */
export function createStoreHook<T extends Record<string, () => any>>(
  stores: T,
) {
  function useStore<K extends keyof T>(key: K): Readonly<ReturnType<T[K]>>
  function useStore<K extends keyof T>(keys: K[]): Readonly<{ [P in K]: ReturnType<T[P]> }>

  /**
   * Хук для доступа к сторам.
   * @param keyOrKeys - Один ключ или массив ключей сторов для получения.
   */
  function useStore<K extends keyof T>(keyOrKeys: K | K[]) {
    if (Array.isArray(keyOrKeys)) {
      const requestedStores = Object.fromEntries(
        keyOrKeys.map(key => [key, stores[key]()]),
      ) as { [P in K]: ReturnType<T[P]> }
      return requestedStores
    }

    const store = stores[keyOrKeys]()

    return store
  }

  return useStore
}
