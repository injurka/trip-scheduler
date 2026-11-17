import type { MaybeRefOrGetter } from 'vue'
import { calendarDay } from '@limiteddissolve/track-processing'
import { useEventListener, useIntervalFn } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'

export function useCalendarDay(timeZone: MaybeRefOrGetter<string>) {
  const now = ref(Date.now())
  const update = () => {
    now.value = Date.now()
  }
  useIntervalFn(update, 1000)
  useEventListener(window, 'focus', update)
  useEventListener(document, 'visibilitychange', update)

  return computed(() => calendarDay(now.value, toValue(timeZone)))
}
