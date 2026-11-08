import type { Ref } from 'vue'
import { getCurrentInstance, nextTick, onUnmounted, watch } from 'vue'

export interface UseDialogHistoryOptions {
  canClose?: () => boolean
}

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

export function hasOpenModals() {
  return openModalsStack.length > 0
}

// Let v-model changes reach the dialog before waiting for its history cleanup.
// Navigation must start after popstate, otherwise Back can cancel the router push.
export async function waitForDialogHistory(): Promise<void> {
  await nextTick()

  let cleanup = pendingBack

  while (cleanup) {
    await cleanup
    cleanup = pendingBack
  }
}

// Only called for a modal entry we pushed: wait for traversal, even on slow devices.
function waitForPopState(onPop?: () => void): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false

    function finish() {
      if (settled)
        return

      settled = true

      window.removeEventListener('popstate', onPopState)
      onPop?.()

      // Suspend parent listeners for the entire event dispatch.
      queueMicrotask(() => {
        pendingBack = undefined
        resolve()
      })
    }

    function onPopState() {
      finish()
    }

    window.addEventListener('popstate', onPopState, { once: true })
    window.history.back()
  })
}

export function useDialogHistory(dialogId: string, visible: Ref<boolean>, options?: UseDialogHistoryOptions) {
  let disposed = false
  let closingFromPopState = false
  let didCleanupOnPopState = false
  let savedScroll = { left: 0, top: 0 }

  function restoreScrollPosition() {
    if (window.scrollX !== savedScroll.left || window.scrollY !== savedScroll.top) {
      window.scrollTo({ left: savedScroll.left, top: savedScroll.top, behavior: 'instant' })
    }
  }

  function restoreModalHistoryEntry() {
    if (!openModalsStack.includes(dialogId))
      openModalsStack.push(dialogId)

    window.history.pushState({
      ...window.history.state,
      scroll: savedScroll,
      isModal: true,
      dialogId,
    }, '')
    window.addEventListener('popstate', handlePopState)
  }

  function handlePopState(event: PopStateEvent) {
    if (pendingBack)
      return

    const topId = openModalsStack.at(-1)

    if (topId !== dialogId || !visible.value)
      return

    const state = event.state ?? window.history.state

    if (state?.dialogId === dialogId)
      return

    if (options?.canClose && !options.canClose()) {
      restoreModalHistoryEntry()
      restoreScrollPosition()

      return
    }

    closingFromPopState = true
    didCleanupOnPopState = false
    visible.value = false
    restoreScrollPosition()

    void nextTick(() => {
      const cleanedUp = didCleanupOnPopState
      closingFromPopState = false
      didCleanupOnPopState = false

      if (disposed)
        return

      if (visible.value && (!cleanedUp || !openModalsStack.includes(dialogId))) {
        restoreModalHistoryEntry()
      }
    })
  }

  function popModalHistoryEntry() {
    savedScroll = { left: window.scrollX, top: window.scrollY }
    pendingBack = waitForPopState(restoreScrollPosition)

    return pendingBack
  }

  function enqueuePendingBackCleanup() {
    if (!pendingBack)
      return

    const waitCurrent = pendingBack
    const chained: Promise<void> = waitCurrent.then(async () => {
      if (isUnloading || openModalsStack.includes(dialogId))
        return

      if (window.history.state?.dialogId === dialogId) {
        savedScroll = { left: window.scrollX, top: window.scrollY }
        await waitForPopState(restoreScrollPosition)
      }
    }).finally(() => {
      if (pendingBack === chained)
        pendingBack = undefined
    })
    pendingBack = chained
  }

  function handleBackDispatch() {
    if (!pendingBack && window.history.state?.dialogId === dialogId) {
      void popModalHistoryEntry()
    }
    else if (pendingBack) {
      enqueuePendingBackCleanup()
    }
    else if (window.history.state?.isModal) {
      queueMicrotask(() => {
        if (!isUnloading && !openModalsStack.includes(dialogId))
          enqueuePendingBackCleanup()
      })
    }
  }

  function cleanupHistory() {
    if (typeof window === 'undefined')
      return

    window.removeEventListener('popstate', handlePopState)
    const index = openModalsStack.indexOf(dialogId)

    if (index < 0)
      return

    openModalsStack.splice(index, 1)

    if (closingFromPopState) {
      didCleanupOnPopState = true

      return
    }

    if (isUnloading)
      return

    handleBackDispatch()
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
