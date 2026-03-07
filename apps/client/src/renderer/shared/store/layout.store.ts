export const useLayoutStore = defineStore('layout', () => {
  const headerHeight = ref(0)
  const isHeaderVisible = ref(true)
  const isFloatingMapOpen = ref(false)

  function setHeaderHeight(height: number) {
    headerHeight.value = height
  }

  function setHeaderVisibility(isVisible: boolean) {
    isHeaderVisible.value = isVisible
  }

  function setFloatingMapOpen(isOpen: boolean) {
    isFloatingMapOpen.value = isOpen
  }

  function toggleFloatingMap() {
    isFloatingMapOpen.value = !isFloatingMapOpen.value
  }

  return {
    headerHeight,
    isHeaderVisible,
    isFloatingMapOpen,
    setHeaderHeight,
    setHeaderVisibility,
    setFloatingMapOpen,
    toggleFloatingMap,
  }
})
