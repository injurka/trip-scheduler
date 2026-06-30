import type { DestinationMapPoint } from '~/shared/services/api/model/types'
import type { Country } from '~/shared/types/models/destination-review'
import type { CreateHighlightInput, Highlight } from '~/shared/types/models/user'
import { CalendarDate } from '@internationalized/date'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { useConfirm } from '~/shared/composables/use-confirm'
import { useQuerySync } from '~/shared/composables/use-query-sync'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'

enum EHighlightsKeys {
  FETCH = 'highlights:fetch',
  FETCH_COUNTRIES = 'highlights:fetch-countries',
  FETCH_MAP_POINTS = 'highlights:fetch-map-points',
  CREATE = 'highlights:create',
  UPDATE = 'highlights:update',
  DELETE = 'highlights:delete',
  UPLOAD = 'highlights:upload',
}

export type HighlightImageQuality = 'original' | 'large' | 'medium'

export interface HighlightDateRange {
  start: CalendarDate | null
  end: CalendarDate | null
}

type HighlightFormState = Partial<CreateHighlightInput>

export interface UploadResult {
  url: string
  variants?: Record<string, string>
  metadata?: {
    originalName?: string
    takenAt?: string | null
    latitude?: number | null
    longitude?: number | null
    width?: number | null
    height?: number | null
    metadata?: Record<string, unknown>
  }
}

export interface ExtractedMetadata {
  latitude: number | null
  longitude: number | null
  takenAt: string | null
}

interface RequestError {
  error: {
    customMessage?: string
    message?: string
  }
}

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

function readRationals(view: DataView, offset: number, count: number, littleEndian: boolean): number[] {
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const numerator = view.getUint32(offset + (i * 8), littleEndian)
    const denominator = view.getUint32(offset + (i * 8) + 4, littleEndian)
    result.push(denominator === 0 ? 0 : numerator / denominator)
  }
  return result
}

function extractMetadataFromJpeg(file: File): Promise<ExtractedMetadata> {
  return new Promise((resolve) => {
    const result: ExtractedMetadata = { latitude: null, longitude: null, takenAt: null }
    if (!file || file.type !== 'image/jpeg') {
      return resolve(result)
    }

    const reader = new FileReader()
    reader.onload = function (e) {
      try {
        const buffer = e.target?.result as ArrayBuffer
        if (!buffer)
          return resolve(result)

        const view = new DataView(buffer)
        if (view.getUint16(0, false) !== 0xFFD8)
          return resolve(result)

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
          return resolve(result)
        if (view.getUint32(exifOffset, false) !== 0x45786966)
          return resolve(result)

        const tiffOffset = exifOffset + 6
        const littleEndian = view.getUint16(tiffOffset, false) === 0x4949
        const ifd0Offset = view.getUint32(tiffOffset + 4, littleEndian)
        const numEntries = view.getUint16(tiffOffset + ifd0Offset, littleEndian)

        let gpsOffset = -1
        let exifSubIfdOffset = -1

        for (let i = 0; i < numEntries; i++) {
          const entryOffset = tiffOffset + ifd0Offset + 2 + (i * 12)
          const tag = view.getUint16(entryOffset, littleEndian)
          if (tag === 0x8825) {
            gpsOffset = view.getUint32(entryOffset + 8, littleEndian)
          }
          else if (tag === 0x8769) {
            exifSubIfdOffset = view.getUint32(entryOffset + 8, littleEndian)
          }
        }

        if (gpsOffset !== -1) {
          const gpsNumEntries = view.getUint16(tiffOffset + gpsOffset, littleEndian)
          let lat: number[] | null = null
          let lon: number[] | null = null
          let latRef = 'N'
          let lonRef = 'E'

          for (let i = 0; i < gpsNumEntries; i++) {
            const entryOffset = tiffOffset + gpsOffset + 2 + (i * 12)
            const tag = view.getUint16(entryOffset, littleEndian)
            const dataValueOffset = view.getUint32(entryOffset + 8, littleEndian)

            if (tag === 1)
              latRef = String.fromCharCode(view.getUint8(entryOffset + 8))
            else if (tag === 2)
              lat = readRationals(view, tiffOffset + dataValueOffset, 3, littleEndian)
            else if (tag === 3)
              lonRef = String.fromCharCode(view.getUint8(entryOffset + 8))
            else if (tag === 4)
              lon = readRationals(view, tiffOffset + dataValueOffset, 3, littleEndian)
          }

          if (lat && lon && lat.length === 3 && lon.length === 3) {
            let ddLat = lat[0] + lat[1] / 60 + lat[2] / 3600
            let ddLon = lon[0] + lon[1] / 60 + lon[2] / 3600
            if (latRef === 'S')
              ddLat *= -1
            if (lonRef === 'W')
              ddLon *= -1

            result.latitude = Number(ddLat.toFixed(6))
            result.longitude = Number(ddLon.toFixed(6))
          }
        }

        if (exifSubIfdOffset !== -1) {
          const exifNumEntries = view.getUint16(tiffOffset + exifSubIfdOffset, littleEndian)
          for (let i = 0; i < exifNumEntries; i++) {
            const entryOffset = tiffOffset + exifSubIfdOffset + 2 + (i * 12)
            const tag = view.getUint16(entryOffset, littleEndian)

            if (tag === 0x9003) {
              const dataValueOffset = view.getUint32(entryOffset + 8, littleEndian)
              if (tiffOffset + dataValueOffset + 19 <= view.byteLength) {
                let dateStr = ''
                for (let j = 0; j < 19; j++) {
                  dateStr += String.fromCharCode(view.getUint8(tiffOffset + dataValueOffset + j))
                }
                const parts = dateStr.split(' ')
                if (parts.length === 2) {
                  const datePart = parts[0].replace(/:/g, '-')
                  result.takenAt = `${datePart}T${parts[1]}.000Z`
                }
              }
              break
            }
          }
        }

        resolve(result)
      }
      catch {
        resolve(result)
      }
    }

    reader.readAsArrayBuffer(file.slice(0, 128 * 1024))
  })
}

export function useHighlights() {
  const authStore = useAuthStore()
  const route = useRoute()
  const toast = useToast()
  const confirm = useConfirm()

  const userId = computed(() => route.params.id as string || authStore.user?.id || '')

  const highlights = ref<Highlight[]>([])
  const totalItems = ref(0)

  const currentPage = useQuerySync('page', 1)
  const itemsPerPage = 30

  const selectedCities = useQuerySync<string[]>('cities', [])

  const dateRange = useQuerySync<HighlightDateRange | null>('dates', null, {
    parse(val) {
      const str = Array.isArray(val) ? val[0] : val
      if (!str)
        return null
      const [start, end] = str.split('~')
      const parseDate = (d: string) => {
        if (!d)
          return null
        const [y, m, day] = d.split('-').map(Number)
        return new CalendarDate(y, m, day)
      }
      return {
        start: parseDate(start),
        end: parseDate(end),
      }
    },
    serialize(val) {
      if (!val || (!val.start && !val.end))
        return undefined
      const s = val.start ? `${val.start.year}-${val.start.month}-${val.start.day}` : ''
      const e = val.end ? `${val.end.year}-${val.end.month}-${val.end.day}` : ''
      return `${s}~${e}`
    },
  })

  const countries = ref<Country[]>([])
  const mapPoints = ref<DestinationMapPoint[]>([])
  const quality = useQuerySync<HighlightImageQuality>('quality', 'large')

  const isCreateModalOpen = ref(false)
  const isEditModalOpen = ref(false)
  const editingHighlight = ref<Highlight | null>(null)

  const isLoading = useRequestStatus(EHighlightsKeys.FETCH)
  const isUploading = useRequestStatus(EHighlightsKeys.UPLOAD)
  const isCreating = useRequestStatus(EHighlightsKeys.CREATE)
  const isUpdating = useRequestStatus(EHighlightsKeys.UPDATE)
  const areCountriesLoading = useRequestStatus(EHighlightsKeys.FETCH_COUNTRIES)

  const isActionProcessing = ref(false)
  const isSubmitting = computed(() => isCreating.value || isUpdating.value || isUploading.value || isActionProcessing.value)

  const form = reactive<HighlightFormState>(createEmptyForm())
  const editForm = reactive<HighlightFormState>(createEmptyForm())

  const formFile = ref<File | null>(null)
  const editFormFile = ref<File | null>(null)

  const fetchError = ref(false)

  const availableCities = ref<string[]>([])
  const filteredHighlights = computed(() => highlights.value)

  async function fetchHighlightCities() {
    if (!userId.value)
      return

    await useRequest({
      key: 'highlights:fetch-cities',
      fn: db => db.user.getHighlightCities(userId.value),
      onSuccess: (data) => {
        availableCities.value = data
      },
    })
  }

  async function fetchHighlights() {
    if (!userId.value)
      return
    fetchError.value = false

    const filters: Record<string, string | string[]> = {}
    if (selectedCities.value.length > 0) {
      filters.cities = selectedCities.value
    }

    if (dateRange.value?.start) {
      const s = dateRange.value.start
      filters.startDate = new Date(s.year, s.month - 1, s.day, 0, 0, 0).toISOString()
    }

    if (dateRange.value?.end) {
      const e = dateRange.value.end
      filters.endDate = new Date(e.year, e.month - 1, e.day, 23, 59, 59).toISOString()
    }

    await useRequest({
      key: EHighlightsKeys.FETCH,
      fn: db => db.user.getHighlights(userId.value, itemsPerPage, currentPage.value, filters),
      onSuccess: (data) => {
        highlights.value = data.items
        totalItems.value = data.total
      },
      onError: (err: RequestError) => {
        fetchError.value = true
        toast.error(err.error?.customMessage || 'Не удалось загрузить витрину.')
      },
    })
  }

  watch([selectedCities, dateRange], () => {
    if (currentPage.value !== 1) {
      currentPage.value = 1
    }
    else {
      fetchHighlights()
    }
  }, { deep: true })

  watch(currentPage, () => {
    fetchHighlights()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  async function fetchCountries() {
    if (countries.value.length > 0)
      return

    await useRequest({
      key: EHighlightsKeys.FETCH_COUNTRIES,
      fn: db => db.destinationReviews.getCountries(),
      onSuccess: (data) => {
        countries.value = data
      },
      onError: (err: RequestError) => {
        toast.error(err.error?.customMessage || 'Не удалось загрузить список стран.')
      },
    })
  }

  async function fetchMapPoints() {
    if (!userId.value || mapPoints.value.length > 0)
      return

    await useRequest({
      key: EHighlightsKeys.FETCH_MAP_POINTS,
      fn: db => db.destinationReviews.getMapPoints(userId.value),
      onSuccess: (data) => { mapPoints.value = data },
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
      countryId: highlight.countryId || highlight.country?.id || '',
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

  function syncCountryFromMetadata(target: HighlightFormState, rawMeta: Record<string, unknown>) {
    const iptc = rawMeta.iptc as Record<string, unknown> | undefined
    const exifCountry = typeof iptc?.country === 'string' ? iptc.country.trim() : null

    if (!exifCountry || target.countryId || countries.value.length === 0)
      return

    const normalized = exifCountry.toLowerCase()
    const matchedCountry = countries.value.find((country: Country) =>
      country.name.toLowerCase() === normalized,
    )

    if (matchedCountry) {
      target.countryId = matchedCountry.id
    }
  }

  function applyUploadedImage(target: HighlightFormState, data: UploadResult) {
    target.imageUrl = data.url
    target.variants = data.variants || {}

    const uploadMeta = data.metadata || {}
    const rawMeta = uploadMeta.metadata || {}

    target.latitude = uploadMeta.latitude ?? target.latitude ?? null
    target.longitude = uploadMeta.longitude ?? target.longitude ?? null
    target.takenAt = uploadMeta.takenAt ?? target.takenAt ?? null
    target.width = uploadMeta.width ?? null
    target.height = uploadMeta.height ?? null

    target.metadata = rawMeta

    const iptc = rawMeta.iptc as Record<string, unknown> | undefined
    if (typeof iptc?.city === 'string' && !target.city) {
      target.city = iptc.city
    }

    syncCountryFromMetadata(target, rawMeta)
  }

  function uploadHighlightImage(file: File, target: HighlightFormState, fileRef: typeof formFile): Promise<boolean> {
    return new Promise((resolve) => {
      useRequest<UploadResult>({
        key: EHighlightsKeys.UPLOAD,
        fn: db => db.files.uploadFile(file, authStore.user!.id, 'highlight', null) as unknown as Promise<UploadResult>,
        onSuccess: (data) => {
          applyUploadedImage(target, data)
          resolve(true)
        },
        onError: (err: RequestError) => {
          toast.error(err.error?.customMessage || err.error?.message || 'Не удалось загрузить файл.')
          fileRef.value = null
          resolve(false)
        },
      })
    })
  }

  async function handleFileSelect(file: File | null) {
    if (!file) {
      resetCreateForm()
      return
    }

    formFile.value = file
    form.imageUrl = URL.createObjectURL(file)

    const meta = await extractMetadataFromJpeg(file)
    if (meta.latitude !== null)
      form.latitude = meta.latitude
    if (meta.longitude !== null)
      form.longitude = meta.longitude
    if (meta.takenAt !== null)
      form.takenAt = meta.takenAt
  }

  async function handleEditFileSelect(file: File | null) {
    if (!file) {
      editFormFile.value = null
      restoreOriginalEditImage()
      return
    }

    editFormFile.value = file
    editForm.imageUrl = URL.createObjectURL(file)

    const meta = await extractMetadataFromJpeg(file)
    if (meta.latitude !== null)
      editForm.latitude = meta.latitude
    if (meta.longitude !== null)
      editForm.longitude = meta.longitude
    if (meta.takenAt !== null)
      editForm.takenAt = meta.takenAt
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
    await Promise.all([fetchCountries(), fetchMapPoints()])
    isCreateModalOpen.value = true
  }

  async function openEditModal(highlight: Highlight) {
    editingHighlight.value = highlight
    fillEditForm(highlight)
    editFormFile.value = null
    await Promise.all([fetchCountries(), fetchMapPoints()])
    isEditModalOpen.value = true
  }

  async function submitHighlight() {
    if (!isFormValid(form)) {
      toast.error('Заполни фото, страну и город.')
      return
    }

    isActionProcessing.value = true
    try {
      if (formFile.value) {
        const success = await uploadHighlightImage(formFile.value, form, formFile)
        if (!success)
          return
      }

      await useRequest({
        key: EHighlightsKeys.CREATE,
        fn: db => db.user.createHighlight(normalizeForm(form)),
        onSuccess: async () => {
          toast.success('Фото добавлено.')
          isCreateModalOpen.value = false
          setTimeout(resetCreateForm, 300)

          if (currentPage.value !== 1) {
            currentPage.value = 1
          }
          else {
            await fetchHighlights()
            await fetchHighlightCities()
          }
        },
        onError: (err: RequestError) => {
          toast.error(err.error?.customMessage || 'Не удалось создать фото.')
        },
      })
    }
    finally {
      isActionProcessing.value = false
    }
  }

  async function submitEditHighlight() {
    if (!editingHighlight.value)
      return

    if (!isFormValid(editForm)) {
      toast.error('Заполни фото, страну и город.')
      return
    }

    isActionProcessing.value = true
    try {
      if (editFormFile.value) {
        await uploadHighlightImage(editFormFile.value, editForm, editFormFile)
      }
      // TODO: В будущем добавить db.user.updateHighlight(...)
    }
    finally {
      isActionProcessing.value = false
    }
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
        highlights.value = highlights.value.filter((item: Highlight) => item.id !== id)
        totalItems.value--
        fetchHighlightCities()
      },
      onError: (err: RequestError) => {
        toast.error(err.error?.customMessage || 'Не удалось удалить фото.')
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
    filteredHighlights,
    totalItems,
    currentPage,
    itemsPerPage,
    countries,
    mapPoints,
    quality,
    selectedCities,
    dateRange,
    availableCities,
    isLoading,
    fetchError,
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
    fetchHighlightCities,
    fetchCountries,
    fetchMapPoints,
    openCreateModal,
    openEditModal,
    handleFileSelect,
    handleEditFileSelect,
    submitHighlight,
    submitEditHighlight,
    deleteHighlight,
  }
}
