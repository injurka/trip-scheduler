import { ref } from 'vue'

const ONBOARDING_STORAGE_KEY = 'ts_onboarding_completed'
const hasSeenOnboarding = ref(false)
let isInitialized = false

export function useOnboarding() {
  function checkStatus(): boolean {
    if (typeof window === 'undefined') {
      return true
    }

    try {
      hasSeenOnboarding.value = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'

      return hasSeenOnboarding.value
    }
    catch {
      return false
    }
  }

  function initOnboarding(): boolean {
    if (typeof window === 'undefined' || isInitialized)
      return false

    isInitialized = true

    return !checkStatus()
  }

  function completeOnboarding() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
      }
      catch {
        // Игнорируем ошибки при квоте или приватном режиме
      }
    }

    hasSeenOnboarding.value = true
  }

  return { hasSeenOnboarding, checkStatus, initOnboarding, completeOnboarding }
}
