import type { UpdateTripInput } from '~/shared/types/models/trip'
import { TripSectionType } from '~/shared/types/models/trip'
import { useModuleStore } from './use-trip-info-module'

export const SECTION_SLUG_MAP: Record<string, TripSectionType> = {
  bookings: TripSectionType.BOOKINGS,
  finances: TripSectionType.FINANCES,
  checklist: TripSectionType.CHECKLIST,
  documents: TripSectionType.DOCUMENTS,
  gallery: TripSectionType.MEMORIES,
}

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

  const tripId = computed(() => route.params.id as string)
  const dayId = computed(() => route.query.day as string)
  const sectionQuery = computed(() => route.query.section as string)

  const resolvedSectionId = computed(() => {
    const query = sectionQuery.value
    if (!query || query === 'overview')
      return null

    if (query === 'map')
      return 'map'

    const type = SECTION_SLUG_MAP[query]
    if (type) {
      const section = sections.sections.find(s => s.type === type)
      return section ? section.id : null
    }

    return query
  })

  const isMapView = computed(() => sectionQuery.value === 'map')

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
