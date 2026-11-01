import { ref } from 'vue'

const ONBOARDING_STORAGE_KEY = 'ts_onboarding_completed'

const isOnboardingOpen = ref(false)
const hasSeenOnboarding = ref(false)
let isInitialized = false

export function useOnboarding() {
  function checkStatus(): boolean {
    if (typeof window === 'undefined') {
      return true
    }

    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      hasSeenOnboarding.value = stored === 'true'

      return hasSeenOnboarding.value
    }
    catch {
      return false
    }
  }

  function initOnboarding(options?: { force?: boolean }) {
    if (typeof window === 'undefined')
      return

    const alreadySeen = checkStatus()

    if (options?.force) {
      isOnboardingOpen.value = true

      return
    }

    if (!isInitialized) {
      isInitialized = true

      if (!alreadySeen) {
        isOnboardingOpen.value = true
      }
    }
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
    isOnboardingOpen.value = false
  }

  function openOnboarding() {
    isOnboardingOpen.value = true
  }

  function closeOnboarding() {
    completeOnboarding()
  }

  function resetOnboarding() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(ONBOARDING_STORAGE_KEY)
      }
      catch {
        // Игнорируем
      }
    }

    hasSeenOnboarding.value = false
    isOnboardingOpen.value = true
  }

  return {
    isOnboardingOpen,
    hasSeenOnboarding,
    initOnboarding,
    completeOnboarding,
    openOnboarding,
    closeOnboarding,
    resetOnboarding,
  }
}
