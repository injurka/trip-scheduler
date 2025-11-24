import type { UpdateTripInput } from '~/shared/types/models/trip'
import { useModuleStore } from './use-trip-info-module'

export function useTripInfoView() {
  const route = useRoute()
  const router = useRouter()

  const { plan, ui, sections, memories, routeGallery } = useModuleStore([
    'plan',
    'ui',
    'routeGallery',
    'memories',
    'sections',
  ])

  const { activeView } = storeToRefs(ui)

  // --- Computed IDs from Route ---
  const tripId = computed(() => route.params.id as string)
  const dayId = computed(() => route.query.day as string)
  const sectionId = computed(() => route.query.section as string)
  const isMapView = computed(() => route.query.view === 'map')

  // --- Initialization ---
  function init() {
    if (tripId.value) {
      plan.fetchTripDetails(
        tripId.value,
        dayId.value,
        (loadedSections) => {
          sections.setSections(loadedSections)
        },
      )
    }
  }

  // --- Watchers: URL <-> Store Synchronization ---

  // 1. URL -> Store: При изменении URL обновляем активный вид
  watch(
    () => route.query.view,
    (newView) => {
      if (newView === 'memories')
        ui.setActiveView('memories')
      else if (newView === 'plan')
        ui.setActiveView('plan')
    },
    { immediate: true },
  )

  // 2. Store -> URL: При переключении табов обновляем URL
  watch(
    activeView,
    (newView) => {
      // Не меняем URL если мы в режиме карты, секции или не выбран день
      if (isMapView.value || sectionId.value || !dayId.value)
        return

      // Не добавляем параметр, если это split режим или он уже стоит
      if (newView === 'split' || route.query.view === newView)
        return

      router.replace({
        query: {
          ...route.query,
          view: newView,
        },
      })
    },
  )

  // 3. Store (Day) -> URL: При смене дня обновляем URL, СОХРАНЯЯ вид
  watch(
    () => plan.currentDayId,
    (newDayId, oldDayId) => {
      // Скролл вверх при смене дня
      if (newDayId && newDayId !== oldDayId) {
        ui.clearCollapsedState()
        nextTick(() => {
          window.scrollTo({ top: 0, behavior: 'instant' })
        })
      }

      // Если ID дня в сторе отличается от URL
      if (newDayId && newDayId !== route.query.day) {
        // Определяем, какой view записать в query
        // Если split - не пишем ничего (дефолт), иначе текущий активный
        const currentViewParam = activeView.value === 'split' ? undefined : activeView.value

        router.replace({
          query: {
            ...route.query,
            day: newDayId,
            section: undefined,
            // Если была карта - остаемся в карте, иначе берем текущий вид
            view: isMapView.value ? 'map' : currentViewParam,
          },
        })
      }
      else if (!newDayId && route.query.day) {
        // Если день сброшен (вернулись к обзору)
        const newQuery = { ...route.query }
        delete newQuery.day
        if (!isMapView.value)
          delete newQuery.view

        router.replace({ query: newQuery })
      }
    },
  )

  // 4. URL (Day) -> Store
  watch(
    dayId,
    (newDayId) => {
      if (newDayId && newDayId !== plan.currentDayId) {
        plan.setCurrentDay(newDayId)
      }
      else if (!newDayId && plan.currentDayId && !sectionId.value && !isMapView.value) {
        plan.setCurrentDay('')
      }
    },
    { immediate: true },
  )

  // 5. Load Memories when entering memories view
  watch(
    [activeView, tripId],
    ([view, tId]) => {
      if ((view === 'memories' || view === 'split') && tId) {
        memories.fetchMemories(tId)
      }
    },
    { immediate: true },
  )

  // --- Cleanup ---
  onBeforeUnmount(() => {
    plan.reset()
    memories.reset()
    sections.reset()
    routeGallery.reset()
    ui.reset()
  })

  return {
    tripId,
    dayId,
    sectionId,
    isMapView,
    init,
    handleSaveTrip: (updatedData: UpdateTripInput) => plan.updateTrip(updatedData),
  }
}
