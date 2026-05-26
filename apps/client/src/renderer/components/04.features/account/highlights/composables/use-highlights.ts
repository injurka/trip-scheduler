import type { Country, DestinationReview } from '~/shared/types/models/destination-review'
import type { TripImage } from '~/shared/types/models/trip'
import type { CreateHighlightInput, Highlight } from '~/shared/types/models/user'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { useConfirm } from '~/shared/composables/use-confirm'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'

enum EHighlightsKeys {
  FETCH = 'highlights:fetch',
  FETCH_COUNTRIES = 'highlights:fetch-countries',
  FETCH_REVIEWS = 'highlights:fetch-reviews',
  CREATE = 'highlights:create',
  UPDATE = 'highlights:update',
  DELETE = 'highlights:delete',
  UPLOAD = 'highlights:upload',
}

export type HighlightImageQuality = 'original' | 'large' | 'medium'

type HighlightFormState = Partial<CreateHighlightInput>

function createEmptyForm(): HighlightFormState {
  return {
    imageUrl: '',
    countryId: '',
    city: '',
    address: '',
    comment: '',
    latitude: null,
    longitude: null,
    takenAt: null,
    width: null,
    height: null,
    variants: {},
    metadata: null,
  }
}

// Утилита для чтения рациональных чисел (EXIF формат) из DataView
function readRationals(view: DataView, offset: number, count: number, littleEndian: boolean): number[] {
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const numerator = view.getUint32(offset + (i * 8), littleEndian)
    const denominator = view.getUint32(offset + (i * 8) + 4, littleEndian)
    result.push(denominator === 0 ? 0 : numerator / denominator)
  }
  return result
}

// Быстрое локальное извлечение GPS из JPEG файла через FileReader API
function extractGpsFromJpeg(file: File): Promise<{ latitude: number, longitude: number } | null> {
  return new Promise((resolve) => {
    if (!file || file.type !== 'image/jpeg') {
      resolve(null)
      return
    }

    const reader = new FileReader()
    reader.onload = function (e) {
      try {
        const buffer = e.target?.result as ArrayBuffer
        if (!buffer)
          return resolve(null)

        const view = new DataView(buffer)
        if (view.getUint16(0, false) !== 0xFFD8)
          return resolve(null)

        let offset = 2
        const length = view.byteLength
        let exifOffset = -1

        while (offset < length - 2) {
          const marker = view.getUint16(offset, false)
          if (marker === 0xFFE1) {
            exifOffset = offset + 4
            break
          }
          offset += view.getUint16(offset + 2, false) + 2
        }

        if (exifOffset === -1)
          return resolve(null)
        if (view.getUint32(exifOffset, false) !== 0x45786966)
          return resolve(null) // "Exif"

        const tiffOffset = exifOffset + 6
        const littleEndian = view.getUint16(tiffOffset, false) === 0x4949
        const ifd0Offset = view.getUint32(tiffOffset + 4, littleEndian)
        const numEntries = view.getUint16(tiffOffset + ifd0Offset, littleEndian)

        let gpsOffset = -1
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = tiffOffset + ifd0Offset + 2 + (i * 12)
          const tag = view.getUint16(entryOffset, littleEndian)
          if (tag === 0x8825) { // GPSInfo
            gpsOffset = view.getUint32(entryOffset + 8, littleEndian)
            break
          }
        }

        if (gpsOffset === -1)
          return resolve(null)

        const gpsNumEntries = view.getUint16(tiffOffset + gpsOffset, littleEndian)
        let lat: number[] | null = null
        let lon: number[] | null = null
        let latRef = 'N'
        let lonRef = 'E'

        for (let i = 0; i < gpsNumEntries; i++) {
          const entryOffset = tiffOffset + gpsOffset + 2 + (i * 12)
          const tag = view.getUint16(entryOffset, littleEndian)
          const dataValueOffset = view.getUint32(entryOffset + 8, littleEndian)

          if (tag === 1) { // GPSLatitudeRef
            latRef = String.fromCharCode(view.getUint8(entryOffset + 8))
          }
          else if (tag === 2) { // GPSLatitude
            lat = readRationals(view, tiffOffset + dataValueOffset, 3, littleEndian)
          }
          else if (tag === 3) { // GPSLongitudeRef
            lonRef = String.fromCharCode(view.getUint8(entryOffset + 8))
          }
          else if (tag === 4) { // GPSLongitude
            lon = readRationals(view, tiffOffset + dataValueOffset, 3, littleEndian)
          }
        }

        if (lat && lon && lat.length === 3 && lon.length === 3) {
          let ddLat = lat[0] + lat[1] / 60 + lat[2] / 3600
          let ddLon = lon[0] + lon[1] / 60 + lon[2] / 3600
          if (latRef === 'S')
            ddLat *= -1
          if (lonRef === 'W')
            ddLon *= -1

          resolve({
            latitude: Number(ddLat.toFixed(6)),
            longitude: Number(ddLon.toFixed(6)),
          })
        }
        else {
          resolve(null)
        }
      }
      catch (err) {
        resolve(null)
      }
    }

    // Читаем только первые 128KB, обычно EXIF находится там - это экономит ресурсы
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024))
  })
}

// Запасной парсинг координат, если они приходят внутри поля metadata с бэкенда
function extractGPSFromMetadata(metadata: any): { lat: number, lon: number } | null {
  if (!metadata)
    return null

  const lat = metadata.latitude ?? metadata.gps?.latitude ?? metadata.exif?.GPSLatitude ?? metadata.exif?.latitude
  const lon = metadata.longitude ?? metadata.gps?.longitude ?? metadata.exif?.GPSLongitude ?? metadata.exif?.longitude

  let finalLat: number | null = typeof lat === 'number' ? lat : null
  let finalLon: number | null = typeof lon === 'number' ? lon : null

  // Если сервер вернул массив [deg, min, sec]
  if (finalLat === null && Array.isArray(lat) && lat.length === 3) {
    finalLat = lat[0] + lat[1] / 60 + lat[2] / 3600
    if (metadata.exif?.GPSLatitudeRef === 'S')
      finalLat *= -1
  }

  if (finalLon === null && Array.isArray(lon) && lon.length === 3) {
    finalLon = lon[0] + lon[1] / 60 + lon[2] / 3600
    if (metadata.exif?.GPSLongitudeRef === 'W')
      finalLon *= -1
  }

  if (finalLat !== null && finalLon !== null) {
    return { lat: Number(finalLat.toFixed(6)), lon: Number(finalLon.toFixed(6)) }
  }

  return null
}

export function useHighlights() {
  const authStore = useAuthStore()
  const route = useRoute()
  const toast = useToast()
  const confirm = useConfirm()

  const userId = computed(() => route.params.id as string || authStore.user?.id || '')

  const highlights = ref<Highlight[]>([])
  const countries = ref<Country[]>([])
  const reviews = ref<DestinationReview[]>([])
  const quality = ref<HighlightImageQuality>('large')

  const isCreateModalOpen = ref(false)
  const isEditModalOpen = ref(false)
  const editingHighlight = ref<Highlight | null>(null)

  const isLoading = useRequestStatus(EHighlightsKeys.FETCH)
  const isUploading = useRequestStatus(EHighlightsKeys.UPLOAD)
  const isCreating = useRequestStatus(EHighlightsKeys.CREATE)
  const isUpdating = useRequestStatus(EHighlightsKeys.UPDATE)
  const areCountriesLoading = useRequestStatus(EHighlightsKeys.FETCH_COUNTRIES)

  const isSubmitting = computed(() => isCreating.value || isUpdating.value)

  const form = reactive<HighlightFormState>(createEmptyForm())
  const editForm = reactive<HighlightFormState>(createEmptyForm())

  const formFile = ref<File | null>(null)
  const editFormFile = ref<File | null>(null)

  async function fetchHighlights() {
    if (!userId.value)
      return

    await useRequest({
      key: EHighlightsKeys.FETCH,
      fn: db => db.user.getHighlights(userId.value),
      onSuccess: (data) => {
        highlights.value = data
      },
      onError: (error: any) => {
        toast.error(error?.customMessage || 'Не удалось загрузить highlights.')
      },
    })
  }

  async function fetchCountries() {
    if (countries.value.length > 0)
      return

    await useRequest({
      key: EHighlightsKeys.FETCH_COUNTRIES,
      fn: db => db.destinationReviews.getCountries(),
      onSuccess: (data) => {
        countries.value = data
      },
      onError: (error: any) => {
        toast.error(error?.customMessage || 'Не удалось загрузить список стран.')
      },
    })
  }

  async function fetchReviews() {
    if (!userId.value)
      return
    await useRequest({
      key: EHighlightsKeys.FETCH_REVIEWS,
      fn: db => db.destinationReviews.getUserReviews({ userId: userId.value, type: 'city' }),
      onSuccess: (data) => { reviews.value = data },
    })
  }

  function resetCreateForm() {
    Object.assign(form, createEmptyForm())
    formFile.value = null
  }

  function resetEditForm() {
    Object.assign(editForm, createEmptyForm())
    editFormFile.value = null
    editingHighlight.value = null
  }

  function fillEditForm(highlight: Highlight) {
    Object.assign(editForm, {
      imageUrl: highlight.imageUrl || '',
      countryId: (highlight as any).countryId || highlight.country?.id || '',
      city: highlight.city || '',
      address: highlight.address || '',
      comment: highlight.comment || '',
      latitude: highlight.latitude ?? null,
      longitude: highlight.longitude ?? null,
      takenAt: highlight.takenAt ?? null,
      width: highlight.width ?? null,
      height: highlight.height ?? null,
      variants: highlight.variants || {},
      metadata: highlight.metadata || null,
    })
  }

  function restoreOriginalEditImage() {
    if (!editingHighlight.value)
      return

    editForm.imageUrl = editingHighlight.value.imageUrl || ''
    editForm.latitude = editingHighlight.value.latitude ?? null
    editForm.longitude = editingHighlight.value.longitude ?? null
    editForm.takenAt = editingHighlight.value.takenAt ?? null
    editForm.width = editingHighlight.value.width ?? null
    editForm.height = editingHighlight.value.height ?? null
    editForm.variants = editingHighlight.value.variants || {}
    editForm.metadata = editingHighlight.value.metadata || null
  }

  function syncCountryFromMetadata(target: HighlightFormState, data: TripImage) {
    const exifCountry = data.metadata?.iptc?.country?.trim()
    if (!exifCountry || target.countryId || countries.value.length === 0)
      return

    const normalized = exifCountry.toLowerCase()

    const matchedCountry = countries.value.find(country =>
      country.name.toLowerCase() === normalized,
    )

    if (matchedCountry)
      target.countryId = matchedCountry.id
  }

  function applyUploadedImage(target: HighlightFormState, data: TripImage) {
    target.imageUrl = data.url
    target.variants = data.variants || {}

    const metaGps = extractGPSFromMetadata(data.metadata)

    // Приоритет серверу, если он не парсит GPS - оставляем то, что извлеклось локально
    target.latitude = data.latitude ?? metaGps?.lat ?? target.latitude ?? null
    target.longitude = data.longitude ?? metaGps?.lon ?? target.longitude ?? null

    target.takenAt = data.takenAt ?? null
    target.width = data.width ?? null
    target.height = data.height ?? null
    target.metadata = data.metadata || null

    if (data.metadata?.iptc?.city && !target.city)
      target.city = data.metadata.iptc.city

    syncCountryFromMetadata(target, data)
  }

  async function uploadHighlightImage(file: File, target: HighlightFormState, fileRef: typeof formFile) {
    if (!authStore.user?.id)
      return

    fileRef.value = file

    await useRequest<TripImage>({
      key: EHighlightsKeys.UPLOAD,
      fn: db => db.files.uploadFile(file, authStore.user!.id, 'highlight', null),
      onSuccess: (data) => {
        applyUploadedImage(target, data)
      },
      onError: (error: any) => {
        toast.error(error?.customMessage || error?.message || 'Не удалось загрузить файл.')
        fileRef.value = null
      },
    })
  }

  async function handleFileSelect(file: File | null) {
    if (!file) {
      resetCreateForm()
      return
    }

    // Мгновенное извлечение GPS на фронтенде перед или параллельно с загрузкой
    extractGpsFromJpeg(file).then((coords) => {
      if (coords) {
        form.latitude = coords.latitude
        form.longitude = coords.longitude
      }
    })

    await uploadHighlightImage(file, form, formFile)
  }

  async function handleEditFileSelect(file: File | null) {
    if (!file) {
      editFormFile.value = null
      restoreOriginalEditImage()
      return
    }

    // Извлечение GPS при замене фото в режиме редактирования
    extractGpsFromJpeg(file).then((coords) => {
      if (coords) {
        editForm.latitude = coords.latitude
        editForm.longitude = coords.longitude
      }
    })

    await uploadHighlightImage(file, editForm, editFormFile)
  }

  function toNumberOrNull(value: unknown) {
    if (value === '' || value === null || value === undefined)
      return null

    const normalized = Number(value)
    return Number.isNaN(normalized) ? null : normalized
  }

  function normalizeForm(source: HighlightFormState): CreateHighlightInput {
    return {
      imageUrl: source.imageUrl || '',
      countryId: source.countryId || '',
      city: source.city?.trim() || '',
      address: source.address?.trim() || '',
      comment: source.comment?.trim() || '',
      latitude: toNumberOrNull(source.latitude),
      longitude: toNumberOrNull(source.longitude),
      takenAt: source.takenAt || null,
      width: toNumberOrNull(source.width),
      height: toNumberOrNull(source.height),
      variants: source.variants || {},
      metadata: source.metadata || null,
    } as CreateHighlightInput
  }

  function isFormValid(source: HighlightFormState) {
    return Boolean(
      source.imageUrl
      && source.countryId
      && source.city?.trim(),
    )
  }

  async function openCreateModal() {
    resetCreateForm()
    await Promise.all([fetchCountries(), fetchReviews()])
    isCreateModalOpen.value = true
  }

  async function openEditModal(highlight: Highlight) {
    editingHighlight.value = highlight
    fillEditForm(highlight)
    editFormFile.value = null
    await Promise.all([fetchCountries(), fetchReviews()])
    isEditModalOpen.value = true
  }

  async function submitHighlight() {
    if (!isFormValid(form)) {
      toast.error('Заполни фото, страну и город.')
      return
    }

    await useRequest({
      key: EHighlightsKeys.CREATE,
      fn: db => db.user.createHighlight(normalizeForm(form)),
      onSuccess: async () => {
        toast.success('Фото добавлено.')
        isCreateModalOpen.value = false
        setTimeout(resetCreateForm, 300)
        await fetchHighlights()
      },
      onError: (error: any) => {
        toast.error(error?.customMessage || 'Не удалось создать фото.')
      },
    })
  }

  async function submitEditHighlight() {
    if (!editingHighlight.value)
      return

    if (!isFormValid(editForm)) {
      toast.error('Заполни фото, страну и город.')
    }
    // Здесь должна быть логика обновления фото, если она отсутствует в исходнике
  }

  async function deleteHighlight(id: string) {
    const isConfirmed = await confirm({
      title: 'Удалить фото?',
      description: 'Это действие нельзя отменить.',
      type: 'danger',
      confirmText: 'Удалить',
    })

    if (!isConfirmed)
      return

    await useRequest({
      key: `${EHighlightsKeys.DELETE}:${id}`,
      fn: db => db.user.deleteHighlight(id),
      onSuccess: () => {
        toast.success('Фото удалено.')
        highlights.value = highlights.value.filter(item => item.id !== id)
      },
      onError: (error: any) => {
        toast.error(error?.customMessage || 'Не удалось удалить фото.')
      },
    })
  }

  watch(isCreateModalOpen, (visible) => {
    if (!visible)
      setTimeout(resetCreateForm, 300)
  })

  watch(isEditModalOpen, (visible) => {
    if (!visible)
      setTimeout(resetEditForm, 300)
  })

  return {
    userId,
    highlights,
    countries,
    reviews,
    quality,
    isLoading,
    isUploading,
    isSubmitting,
    areCountriesLoading,
    isCreateModalOpen,
    isEditModalOpen,
    editingHighlight,
    form,
    editForm,
    formFile,
    editFormFile,
    fetchHighlights,
    fetchCountries,
    openCreateModal,
    openEditModal,
    handleFileSelect,
    handleEditFileSelect,
    submitHighlight,
    submitEditHighlight,
    deleteHighlight,
  }
}
