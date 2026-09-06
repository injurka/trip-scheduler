import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useAppSettingsStore = defineStore('appSettings', () => {
  const enableEruda = useStorage<boolean>('app-settings-enable-eruda', false)

  return {
    enableEruda,
  }
})
