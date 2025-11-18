function useCalendarPopover() {
  const isOpen = ref(false)

  const openCalendar = () => {
    isOpen.value = true
  }

  const closeCalendar = () => {
    isOpen.value = false
  }

  const handleDateSelect = <T>(date: T, callback?: (date: T) => void) => {
    callback?.(date)
    closeCalendar()
  }

  return {
    isOpen,
    openCalendar,
    closeCalendar,
    handleDateSelect,
  }
}

export { useCalendarPopover }
