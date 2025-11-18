export const useLayoutStore = defineStore('layout', () => {
  const headerHeight = ref(0)
  const isHeaderVisible = ref(true)

  function setHeaderHeight(height: number) {
    headerHeight.value = height
  }

  function setHeaderVisibility(isVisible: boolean) {
    isHeaderVisible.value = isVisible
  }

  return {
    headerHeight,
    isHeaderVisible,
    setHeaderHeight,
    setHeaderVisibility,
  }
})
