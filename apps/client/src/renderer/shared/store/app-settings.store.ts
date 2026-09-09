import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useAppSettingsStore = defineStore('appSettings', () => {
  const enableEruda = useStorage<boolean>('app-settings-enable-eruda', false)
  const customMapTilerKey = useStorage<string>('app-settings-custom-maptiler-key', '')
  const customTileUrl = useStorage<string>('app-settings-custom-tile-url', '')
  const customTileName = useStorage<string>('app-settings-custom-tile-name', 'Пользовательские тайлы')
  const activeTileSource = useStorage<string>('app-settings-active-tile-source', 'maptilerStreets')

  return {
    enableEruda,
    customMapTilerKey,
    customTileUrl,
    customTileName,
    activeTileSource,
  }
})
