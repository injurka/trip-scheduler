import type { UpdateTripInput } from '~/shared/types/models/trip'
import { TripSectionType } from '~/shared/types/models/trip'
import { useModuleStore } from './use-trip-info-module'

// Маппинг "красивое имя в URL" -> "Тип секции"
export const SECTION_SLUG_MAP: Record<string, TripSectionType> = {
  bookings: TripSectionType.BOOKINGS,
  finances: TripSectionType.FINANCES,
  checklist: TripSectionType.CHECKLIST,
  documents: TripSectionType.DOCUMENTS,
}

// Обратный маппинг для генерации ссылок
export const SECTION_TYPE_MAP: Record<string, string> = Object.entries(SECTION_SLUG_MAP).reduce((acc, [slug, type]) => {
  acc[type] = slug
  return acc
}, {} as Record<string, string>)

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

  // --- Computed IDs from Route ---
  const tripId = computed(() => route.params.id as string)
  const dayId = computed(() => route.query.day as string)
  const sectionQuery = computed(() => route.query.section as string)

  /**
   * Вычисляет реальный ID секции или специальный ключ ('map') на основе query параметра.
   */
  const resolvedSectionId = computed(() => {
    const query = sectionQuery.value
    if (!query || query === 'overview')
      return null

    // 1. Карта теперь обрабатывается как секция
    if (query === 'map')
      return 'map'

    // 2. Проверяем, является ли query известным слагом (напр. 'bookings')
    const type = SECTION_SLUG_MAP[query]
    if (type) {
      const section = sections.sections.find(s => s.type === type)
      return section ? section.id : null
    }

    // 3. Если это не слаг, считаем что это ID (для кастомных секций)
    return query
  })

  // Оставляем helper, может пригодиться для специфичной логики, но в шаблоне он уже не обязателен
  const isMapView = computed(() => sectionQuery.value === 'map')

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

  // 1. Store (Day) -> URL
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
          },
        })
      }
      else if (!newDayId && route.query.day) {
        const newQuery = { ...route.query }
        delete newQuery.day
        router.replace({ query: newQuery })
      }
    },
  )

  // 2. URL (Day) -> Store
  watch(
    dayId,
    (newDayId) => {
      if (newDayId && newDayId !== plan.currentDayId) {
        plan.setCurrentDay(newDayId)
      }
      else if (!newDayId && plan.currentDayId && !sectionQuery.value) {
        plan.setCurrentDay('')
      }
    },
    { immediate: true },
  )

  // 3. Load Memories
  watch(
    [() => ui.activeView, tripId],
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
    sectionQuery,
    resolvedSectionId,
    isMapView,
    init,
    handleSaveTrip: (updatedData: UpdateTripInput) => plan.updateTrip(updatedData),
  }
}
