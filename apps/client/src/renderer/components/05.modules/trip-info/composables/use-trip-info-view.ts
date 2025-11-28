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

  // 1. URL -> Store
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

  // 2. Store -> URL
  watch(
    activeView,
    (newView) => {
      if (isMapView.value || sectionId.value || !dayId.value)
        return

      // Если текущий view совпадает с URL query, ничего не делаем
      if (route.query.view === newView)
        return

      // Если view == 'plan', мы можем убрать параметр view (сделать чище URL),
      // либо явно проставить 'plan'. Обычно 'plan' это дефолт.
      const queryView = newView === 'plan' ? undefined : newView

      router.replace({
        query: {
          ...route.query,
          view: queryView,
        },
      })
    },
  )

  // 3. Store (Day) -> URL
  watch(
    () => plan.currentDayId,
    (newDayId, oldDayId) => {
      if (newDayId && newDayId !== oldDayId) {
        ui.clearCollapsedState()
        nextTick(() => {
          window.scrollTo({ top: 0, behavior: 'instant' })
        })
      }

      if (newDayId && newDayId !== route.query.day) {
        router.replace({
          query: {
            ...route.query,
            day: newDayId,
            section: undefined,
            // Сохраняем текущий вид (карта или активный таб)
            view: isMapView.value ? 'map' : (activeView.value === 'plan' ? undefined : activeView.value),
          },
        })
      }
      else if (!newDayId && route.query.day) {
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

  // 5. Load Memories
  watch(
    [activeView, tripId],
    ([view, tId]) => {
      if (view === 'memories' && tId) {
        memories.fetchMemories(tId)
      }
    },
    { immediate: true },
  )

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
