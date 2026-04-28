import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'

enum EHighlightsKeys {
  FETCH = 'highlights:fetch',
  FETCH_COUNTRIES = 'highlights:fetch-countries',
  CREATE = 'highlights:create',
  DELETE = 'highlights:delete',
  UPLOAD = 'highlights:upload',
}

export function useHighlights() {
  const authStore = useAuthStore()
  const route = useRoute()
  const toast = useToast()

  // Гарантируем, что получаем именно строку, а не прокси-объект или массив
  const userId = computed(() => {
    const idParam = route.params.id
    const idStr = Array.isArray(idParam) ? idParam[0] : idParam
    return (idStr as string) || authStore.user?.id || ''
  })

  const highlights = ref<any[]>([])
  const countries = ref<any[]>([]) // Справочник стран
  const isCreateModalOpen = ref(false)

  // Автоматический трекинг состояния запросов
  const isLoading = useRequestStatus([EHighlightsKeys.FETCH])
  const isSubmitting = useRequestStatus([EHighlightsKeys.CREATE])
  const isUploading = useRequestStatus([EHighlightsKeys.UPLOAD])
  const areCountriesLoading = useRequestStatus([EHighlightsKeys.FETCH_COUNTRIES])

  const form = reactive({
    file: null as File | null,
    imageUrl: '',
    countryId: '', // Используем ID страны
    city: '',
    address: '',
    comment: '',
    latitude: null as number | null,
    longitude: null as number | null,
  })

  async function fetchHighlights() {
    if (!userId.value)
      return

    await useRequest({
      key: EHighlightsKeys.FETCH,
      // ИСПРАВЛЕНИЕ: Передаем строку, а не объект
      fn: db => db.user.getHighlights(String(userId.value)),
      onSuccess: (data) => {
        highlights.value = data
      },
      onError: () => {
        toast.error('Не удалось загрузить витрину.')
      },
    })
  }

  async function fetchCountries() {
    if (countries.value.length > 0)
      return

    await useRequest({
      key: EHighlightsKeys.FETCH_COUNTRIES,
      fn: db => db.destinationReview.getCountries(),
      onSuccess: (data) => {
        countries.value = data
      },
    })
  }

  async function openCreateModal() {
    resetForm()
    await fetchCountries() // Подгружаем страны перед открытием модалки
    isCreateModalOpen.value = true
  }

  function resetForm() {
    form.file = null
    form.imageUrl = ''
    form.countryId = ''
    form.city = ''
    form.address = ''
    form.comment = ''
    form.latitude = null
    form.longitude = null
  }

  async function handleFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file)
      return

    form.file = file

    await useRequest({
      key: EHighlightsKeys.UPLOAD,
      fn: db => db.files.uploadFile(
        file,
        authStore.user!.id,
        'highlight',
        null,
      ),
      onSuccess: (data: any) => {
        form.imageUrl = data.url

        // Авто-заполнение из EXIF
        if (data.metadata?.latitude && !form.latitude)
          form.latitude = data.metadata.latitude
        if (data.metadata?.longitude && !form.longitude)
          form.longitude = data.metadata.longitude
        if (data.metadata?.iptc?.city && !form.city)
          form.city = data.metadata.iptc.city

        // Пытаемся найти ID страны по её текстовому названию из EXIF
        if (data.metadata?.iptc?.country && !form.countryId && countries.value.length > 0) {
          const exifCountryName = data.metadata.iptc.country.toLowerCase()
          const matchedCountry = countries.value.find(c => c.name.toLowerCase() === exifCountryName)
          if (matchedCountry) {
            form.countryId = matchedCountry.id
          }
        }
      },
      onError: (e: any) => {
        toast.error(e.message || 'Сбой при загрузке изображения')
        form.file = null
      },
    })
  }

  async function submitHighlight() {
    if (!form.imageUrl || !form.countryId || !form.city) {
      toast.error('Пожалуйста, заполните фото, страну и город.')
      return
    }

    await useRequest({
      key: EHighlightsKeys.CREATE,
      fn: db => db.user.createHighlight({
        imageUrl: form.imageUrl,
        countryId: form.countryId,
        city: form.city,
        address: form.address || null,
        comment: form.comment || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
      }),
      onSuccess: () => {
        toast.success('Фото успешно добавлено в витрину!')
        isCreateModalOpen.value = false
        fetchHighlights()
      },
      onError: () => {
        toast.error('Не удалось сохранить фото.')
      },
    })
  }

  async function deleteHighlight(id: string) {
    await useRequest({
      key: `${EHighlightsKeys.DELETE}:${id}`,
      fn: db => db.user.deleteHighlight(id),
      onSuccess: () => {
        toast.success('Фото удалено')
        highlights.value = highlights.value.filter(h => h.id !== id)
      },
      onError: () => {
        toast.error('Ошибка при удалении')
      },
    })
  }

  return {
    userId,
    highlights,
    countries,
    isLoading,
    isCreateModalOpen,
    isUploading,
    isSubmitting,
    areCountriesLoading,
    form,
    fetchHighlights,
    openCreateModal,
    handleFileSelect,
    submitHighlight,
    deleteHighlight,
  }
}
