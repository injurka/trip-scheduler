import type { TripImageWithTrip } from '~/components/05.modules/account/storage/composables/use-storage'
import { computed, onMounted, ref, watch } from 'vue'
import { EStorageKeys } from '~/components/05.modules/account/storage/composables/use-storage'
import { useRequest } from '~/plugins/request'

export function useHighlightsFeed() {
  const allPhotos = ref<TripImageWithTrip[]>([])

  const quality = ref<'fast' | 'detailed' | 'original'>('detailed')
  const filterMode = ref<'all' | 'trips' | 'dates'>('all')
  const dateRange = ref({ start: '', end: '' })

  const page = ref(1)
  const limit = 15 // Подгружаем по 15 фото за раз

  async function fetchPhotos() {
    await useRequest({
      key: `${EStorageKeys.FETCH_FILES}-feed`,
      fn: db => db.files.getAllUserFiles(),
      onSuccess: (data) => {
        allPhotos.value = (data as TripImageWithTrip[]).filter(f =>
          f.originalName?.match(/\.(jpg|jpeg|png|webp|avif)$/i),
        )
      },
    })
  }

  onMounted(() => {
    fetchPhotos()
  })

  const filteredPhotos = computed(() => {
    let result = [...allPhotos.value]

    if (filterMode.value === 'trips') {
      result = result.filter(f => !!f.trip)
    }
    else if (filterMode.value === 'dates' && dateRange.value.start && dateRange.value.end) {
      const startParts = dateRange.value.start.split('.')
      const endParts = dateRange.value.end.split('.')

      if (startParts.length === 2 && endParts.length === 2) {
        const startDate = new Date(Number(startParts[1]), Number(startParts[0]) - 1, 1)
        const endDate = new Date(Number(endParts[1]), Number(endParts[0]), 0) // Последний день месяца

        result = result.filter((f) => {
          const date = f.takenAt ? new Date(f.takenAt) : new Date(f.createdAt)
          return date >= startDate && date <= endDate
        })
      }
    }
    return result
  })

  // Возвращаем чанк для "Infinite scroll"
  const photos = computed(() => {
    return filteredPhotos.value.slice(0, page.value * limit)
  })

  const hasMore = computed(() => photos.value.length < filteredPhotos.value.length)

  function loadMore() {
    if (hasMore.value) {
      page.value++
    }
  }

  watch([filterMode, dateRange], () => {
    page.value = 1
  }, { deep: true })

  return { photos, hasMore, loadMore, quality, filterMode, dateRange }
}
