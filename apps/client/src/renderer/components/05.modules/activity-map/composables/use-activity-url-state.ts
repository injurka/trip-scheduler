import type { Ref } from 'vue'
import type { LocationQueryValue } from 'vue-router'
import type { DateRange } from '../models/types'
import { parseDate } from '@internationalized/date'
import { useDebounceFn } from '@vueuse/core'

interface UseActivityUrlStateOptions {
  defaultCenter: [number, number]
  defaultZoom: number
  viewMode: Ref<'list' | 'map'>
}

export function useActivityUrlState(options: UseActivityUrlStateOptions) {
  const { defaultCenter, defaultZoom, viewMode } = options

  const route = useRoute()
  const router = useRouter()

  const getQueryString = (val: LocationQueryValue | LocationQueryValue[]): string | undefined => {
    if (Array.isArray(val))
      return val[0] || undefined

    return val || undefined
  }

  const viewQuery = getQueryString(route.query.view)
  if (viewQuery === 'map' || viewQuery === 'list') {
    viewMode.value = viewQuery
  }

  const dateRange = shallowRef<DateRange>({
    start: null,
    end: null,
  })

  const startQuery = getQueryString(route.query.start)
  if (startQuery) {
    try {
      dateRange.value.start = parseDate(startQuery)
    }
    catch (e) {
      console.error(e)
    }
  }

  const endQuery = getQueryString(route.query.end)
  if (endQuery) {
    try {
      dateRange.value.end = parseDate(endQuery)
    }
    catch (e) {
      console.error(e)
    }
  }

  const urlLat = Number(getQueryString(route.query.lat)) || defaultCenter[1]
  const urlLon = Number(getQueryString(route.query.lon)) || defaultCenter[0]
  const urlZoom = Number(getQueryString(route.query.zoom)) || defaultZoom

  const mapCenterView = ref<[number, number]>([urlLon, urlLat])
  const mapZoomView = ref<number>(urlZoom)
  const currentLat = ref(urlLat)
  const currentLon = ref(urlLon)
  const currentZoom = ref(urlZoom)

  const setMapPosition = (lat: number, lon: number, zoom: number) => {
    currentLat.value = lat
    currentLon.value = lon
    currentZoom.value = zoom
  }

  const updateUrl = useDebounceFn(() => {
    const query: Record<string, any> = { ...route.query }

    query.view = viewMode.value

    if (dateRange.value.start)
      query.start = dateRange.value.start.toString()
    else
      delete query.start

    if (dateRange.value.end)
      query.end = dateRange.value.end.toString()
    else
      delete query.end

    if (viewMode.value === 'map') {
      query.lat = currentLat.value.toFixed(6)
      query.lon = currentLon.value.toFixed(6)
      query.zoom = Math.round(currentZoom.value).toString()
    }

    router.replace({ query })
  }, 500)

  watch(
    [dateRange, currentLat, currentLon, currentZoom, viewMode],
    () => {
      updateUrl()
    },
    { deep: true },
  )

  return {
    dateRange,
    mapCenterView,
    mapZoomView,
    setMapPosition,
  }
}
