import { ref } from 'vue'

export interface UseDialogFullscreenOptions {
  initial?: boolean
}

export function useDialogFullscreen(options: UseDialogFullscreenOptions = {}) {
  const isFullscreen = ref(options.initial ?? false)

  function toggleFullscreen() {
    isFullscreen.value = !isFullscreen.value
  }

  function enterFullscreen() {
    isFullscreen.value = true
  }

  function exitFullscreen() {
    isFullscreen.value = false
  }

  return {
    isFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  }
}

export type UseDialogFullscreenReturn = ReturnType<typeof useDialogFullscreen>
