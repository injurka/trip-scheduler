import type { Ref } from 'vue'
import { getCurrentInstance, onUnmounted, watch } from 'vue'

const openModalsStack: string[] = []
let pendingBack: Promise<void> | undefined
let isUnloading = false

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    isUnloading = true
  })
  window.addEventListener('pagehide', () => {
    isUnloading = true
  })
  window.addEventListener('pageshow', () => {
    isUnloading = false
  })
}

export function useDialogHistory(dialogId: string, visible: Ref<boolean>) {
  let disposed = false
  let savedScroll = { left: 0, top: 0 }

  function restoreScrollPosition() {
    if (window.scrollX !== savedScroll.left || window.scrollY !== savedScroll.top) {
      window.scrollTo({ left: savedScroll.left, top: savedScroll.top, behavior: 'instant' })
    }
  }

  function handlePopState() {
    if (pendingBack)
      return

    if (openModalsStack.at(-1) === dialogId && visible.value) {
      visible.value = false
      restoreScrollPosition()
    }
  }

  function cleanupHistory() {
    if (typeof window === 'undefined')
      return

    window.removeEventListener('popstate', handlePopState)
    const index = openModalsStack.indexOf(dialogId)

    // Closing and then unmounting must not navigate back twice.
    if (index < 0)
      return

    openModalsStack.splice(index, 1)

    if (!isUnloading && !pendingBack && window.history.state?.dialogId === dialogId) {
      savedScroll = { left: window.scrollX, top: window.scrollY }
      pendingBack = new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => {
          restoreScrollPosition()

          // Suspend parent listeners for the entire event dispatch.
          queueMicrotask(() => {
            pendingBack = undefined
            resolve()
          })
        }, { once: true })
        window.history.back()
      })
    }
  }

  async function registerHistory() {
    // A quick reopen must wait for the previous back operation.
    if (pendingBack)
      await pendingBack

    if (disposed || !visible.value || openModalsStack.includes(dialogId))
      return

    openModalsStack.push(dialogId)
    savedScroll = { left: window.scrollX, top: window.scrollY }
    const currentState = {
      ...window.history.state,
      scroll: savedScroll,
    }
    window.history.replaceState(currentState, '')
    window.history.pushState({ ...currentState, isModal: true, dialogId }, '')
    window.addEventListener('popstate', handlePopState)
  }

  watch(visible, (isOpen) => {
    if (typeof window === 'undefined')
      return

    if (isOpen)
      void registerHistory()
    else
      cleanupHistory()
  }, { immediate: true })

  if (getCurrentInstance()) {
    onUnmounted(() => {
      disposed = true
      cleanupHistory()
    })
  }
}
