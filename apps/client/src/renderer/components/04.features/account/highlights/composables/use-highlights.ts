import type { DestinationMapPoint } from '~/shared/services/api/model/types'
import type { Country } from '~/shared/types/models/destination-review'
import type { GeoPlaceRef } from '~/shared/types/models/geo-place'
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
    geoPlaceId: null,
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

function readRationals(
  view: DataView,
  offset: number,
  count: number,
  littleEndian: boolean,
): number[] {
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

    if (!file || file.type !== 'image/jpeg')
      return resolve(result)

    const reader = new FileReader()
    reader.onload = (event) => {
      resolve(readJpegMetadata(event.target?.result as ArrayBuffer | null, result))
    }
    reader.onerror = () => resolve(result)

    reader.readAsArrayBuffer(file.slice(0, 128 * 1024))
  })
}

function readJpegMetadata(buffer: ArrayBuffer | null, result: ExtractedMetadata): ExtractedMetadata {
  if (!buffer)
    return result

  try {
    const view = new DataView(buffer)
    const exifOffset = findExifOffset(view)

    if (view.getUint16(0, false) !== 0xFFD8 || exifOffset < 0 || view.getUint32(exifOffset, false) !== 0x45786966)
      return result

    const tiffOffset = exifOffset + 6
    const littleEndian = view.getUint16(tiffOffset, false) === 0x4949
    const directoryOffsets = findExifDirectoryOffsets(view, tiffOffset, littleEndian)

    applyGpsMetadata(
      view,
      tiffOffset,
      littleEndian,
      directoryOffsets.gpsOffset,
      result,
    )
    result.takenAt = readExifDate(
      view,
      tiffOffset,
      littleEndian,
      directoryOffsets.exifOffset,
    )
  }
  catch {
    return result
  }

  return result
}

function findExifOffset(view: DataView): number {
  let offset = 2

  while (offset < view.byteLength - 2) {
    const marker = view.getUint16(offset, false)

    if (marker === 0xFFE1)
      return offset + 4

    offset += view.getUint16(offset + 2, false) + 2
  }

  return -1
}

function findExifDirectoryOffsets(view: DataView, tiffOffset: number, littleEndian: boolean): { gpsOffset: number, exifOffset: number } {
  const ifd0Offset = view.getUint32(tiffOffset + 4, littleEndian)
  const numEntries = view.getUint16(tiffOffset + ifd0Offset, littleEndian)
  const offsets = { gpsOffset: -1, exifOffset: -1 }

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = tiffOffset + ifd0Offset + 2 + (i * 12)
    const tag = view.getUint16(entryOffset, littleEndian)

    if (tag === 0x8825)
      offsets.gpsOffset = view.getUint32(entryOffset + 8, littleEndian)
    else if (tag === 0x8769)
      offsets.exifOffset = view.getUint32(entryOffset + 8, littleEndian)
  }

  return offsets
}

function applyGpsMetadata(
  view: DataView,
  tiffOffset: number,
  littleEndian: boolean,
  gpsOffset: number,
  result: ExtractedMetadata,
) {
  if (gpsOffset < 0)
    return

  const count = view.getUint16(tiffOffset + gpsOffset, littleEndian)
  const coordinates = { latitude: null as number[] | null, longitude: null as number[] | null, latitudeRef: 'N', longitudeRef: 'E' }

  for (let i = 0; i < count; i++) {
    const entryOffset = tiffOffset + gpsOffset + 2 + (i * 12)
    readGpsEntry(
      view,
      tiffOffset,
      littleEndian,
      entryOffset,
      coordinates,
    )
  }

  if (!coordinates.latitude || !coordinates.longitude)
    return

  result.latitude = toDecimalDegrees(coordinates.latitude, coordinates.latitudeRef)
  result.longitude = toDecimalDegrees(coordinates.longitude, coordinates.longitudeRef)
}

function readGpsEntry(
  view: DataView,
  tiffOffset: number,
  littleEndian: boolean,
  entryOffset: number,
  coordinates: { latitude: number[] | null, longitude: number[] | null, latitudeRef: string, longitudeRef: string },
) {
  const tag = view.getUint16(entryOffset, littleEndian)
  const valueOffset = view.getUint32(entryOffset + 8, littleEndian)

  switch (tag) {
    case 1:
      coordinates.latitudeRef = String.fromCharCode(view.getUint8(entryOffset + 8))
      break
    case 2:
      coordinates.latitude = readRationals(
        view,
        tiffOffset + valueOffset,
        3,
        littleEndian,
      )
      break
    case 3:
      coordinates.longitudeRef = String.fromCharCode(view.getUint8(entryOffset + 8))
      break
    case 4:
      coordinates.longitude = readRationals(
        view,
        tiffOffset + valueOffset,
        3,
        littleEndian,
      )
      break
  }
}

function toDecimalDegrees(parts: number[], direction: string): number {
  const degrees = parts[0] + parts[1] / 60 + parts[2] / 3600
  const signed = direction === 'S' || direction === 'W' ? -degrees : degrees

  return Number(signed.toFixed(6))
}

function readExifDate(
  view: DataView,
  tiffOffset: number,
  littleEndian: boolean,
  exifOffset: number,
): string | null {
  if (exifOffset < 0)
    return null

  const count = view.getUint16(tiffOffset + exifOffset, littleEndian)

  for (let i = 0; i < count; i++) {
    const entryOffset = tiffOffset + exifOffset + 2 + (i * 12)

    if (view.getUint16(entryOffset, littleEndian) !== 0x9003)
      continue

    const valueOffset = view.getUint32(entryOffset + 8, littleEndian)

    return formatExifDate(view, tiffOffset + valueOffset)
  }

  return null
}

function formatExifDate(view: DataView, offset: number): string | null {
  if (offset + 19 > view.byteLength)
    return null

  let value = ''

  for (let index = 0; index < 19; index++)
    value += String.fromCharCode(view.getUint8(offset + index))

  const [date, time] = value.split(' ')

  return date && time ? `${date.replace(/:/g, '-')}T${time}.000Z` : null
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

  const selectedCityIds = useQuerySync<string[]>('cityIds', [])
  const selectedCityRefs = ref<GeoPlaceRef[]>([])

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

  const filteredHighlights = computed(() => highlights.value)

  let cityFilterHydrationSequence = 0
  watch(selectedCityIds, async (ids) => {
    const sequence = ++cityFilterHydrationSequence

    if (ids.length === 0) {
      selectedCityRefs.value = []

      return
    }

    await useRequest({
      key: 'highlights:hydrate-city-filter',
      force: true,
      fn: db => db.geo.getPlacesByIds(ids),
      onSuccess: (places) => {
        if (sequence === cityFilterHydrationSequence)
          selectedCityRefs.value = places
      },
    })
  }, { immediate: true })

  function setSelectedCityRefs(places: GeoPlaceRef[]) {
    selectedCityRefs.value = places
    selectedCityIds.value = places.map(place => place.id)
  }

  async function fetchHighlights() {
    if (!userId.value)
      return

    fetchError.value = false

    const filters: Record<string, string | string[]> = {}

    if (selectedCityIds.value.length > 0)
      filters.cityIds = selectedCityIds.value

    if (dateRange.value?.start) {
      const s = dateRange.value.start
      filters.startDate = new Date(
        s.year,
        s.month - 1,
        s.day,
        0,
        0,
        0,
      ).toISOString()
    }

    if (dateRange.value?.end) {
      const e = dateRange.value.end
      filters.endDate = new Date(
        e.year,
        e.month - 1,
        e.day,
        23,
        59,
        59,
      ).toISOString()
    }

    await useRequest({
      key: EHighlightsKeys.FETCH,
      fn: db => db.user.getHighlights(
        userId.value,
        itemsPerPage,
        currentPage.value,
        filters,
      ),
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

  watch([selectedCityIds, dateRange], () => {
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
    Object.assign(editForm, createHighlightEditValues(highlight))
  }

  function createHighlightEditValues(highlight: Highlight): HighlightFormState {
    return {
      ...getHighlightIdentityValues(highlight),
      ...getHighlightTextValues(highlight),
      ...getHighlightLocationValues(highlight),
      ...getHighlightImageValues(highlight),
    }
  }

  function getHighlightIdentityValues(highlight: Highlight): Pick<HighlightFormState, 'imageUrl' | 'countryId'> {
    return { imageUrl: highlight.imageUrl || '', countryId: highlight.countryId || highlight.country?.id || '' }
  }

  function getHighlightTextValues(highlight: Highlight): Pick<HighlightFormState, 'city' | 'address' | 'comment'> {
    return { city: highlight.city || '', address: highlight.address || '', comment: highlight.comment || '' }
  }

  function getHighlightLocationValues(highlight: Highlight): Pick<HighlightFormState, 'geoPlaceId' | 'latitude' | 'longitude' | 'takenAt' | 'width' | 'height'> {
    return {
      geoPlaceId: highlight.geoPlaceId ?? null,
      latitude: highlight.latitude ?? null,
      longitude: highlight.longitude ?? null,
      takenAt: highlight.takenAt ?? null,
      width: highlight.width ?? null,
      height: highlight.height ?? null,
    }
  }

  function getHighlightImageValues(highlight: Highlight): Pick<HighlightFormState, 'variants' | 'metadata'> {
    return { variants: highlight.variants || {}, metadata: highlight.metadata || null }
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
      country.name.toLowerCase() === normalized)

    if (matchedCountry) {
      target.countryId = matchedCountry.id
    }
  }

  function applyUploadedImage(target: HighlightFormState, data: UploadResult) {
    target.imageUrl = data.url
    target.variants = data.variants || {}

    const uploadMeta = data.metadata || {}
    const rawMeta = uploadMeta.metadata || {}

    target.metadata = rawMeta
    applyUploadedExifValues(target, uploadMeta)
    applyUploadedIptcCity(target, rawMeta)
    syncCountryFromMetadata(target, rawMeta)
  }

  function applyUploadedExifValues(target: HighlightFormState, uploadMeta: NonNullable<UploadResult['metadata']>) {
    target.latitude = uploadMeta.latitude ?? target.latitude ?? null
    target.longitude = uploadMeta.longitude ?? target.longitude ?? null
    target.takenAt = uploadMeta.takenAt ?? target.takenAt ?? null
    target.width = uploadMeta.width ?? null
    target.height = uploadMeta.height ?? null
  }

  function applyUploadedIptcCity(target: HighlightFormState, rawMeta: Record<string, unknown>) {
    const iptc = rawMeta.iptc as Record<string, unknown> | undefined

    if (typeof iptc?.city === 'string' && !target.city)
      target.city = iptc.city
  }

  function uploadHighlightImage(file: File, target: HighlightFormState, fileRef: typeof formFile): Promise<boolean> {
    return new Promise((resolve) => {
      useRequest<UploadResult>({
        key: EHighlightsKeys.UPLOAD,
        fn: db => db.files.uploadFile(
          file,
          authStore.user!.id,
          'highlight',
          null,
        ) as unknown as Promise<UploadResult>,
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
      ...normalizeHighlightIdentity(source),
      ...normalizeHighlightText(source),
      ...normalizeHighlightCoordinates(source, toNumberOrNull),
      ...normalizeHighlightMedia(source),
    } as CreateHighlightInput
  }

  function normalizeHighlightIdentity(source: HighlightFormState): Pick<CreateHighlightInput, 'imageUrl' | 'countryId' | 'geoPlaceId'> {
    return { imageUrl: source.imageUrl || '', countryId: source.countryId || '', geoPlaceId: source.geoPlaceId || null }
  }

  function normalizeHighlightText(source: HighlightFormState): Pick<CreateHighlightInput, 'city' | 'address' | 'comment'> {
    return {
      city: normalizeText(source.city),
      address: normalizeText(source.address),
      comment: normalizeText(source.comment),
    }
  }

  function normalizeText(value?: string | null): string {
    return value?.trim() || ''
  }

  function normalizeHighlightCoordinates(source: HighlightFormState, normalizeNumber: (value: unknown) => number | null): Pick<CreateHighlightInput, 'latitude' | 'longitude' | 'takenAt' | 'width' | 'height'> {
    return {
      latitude: normalizeNumber(source.latitude),
      longitude: normalizeNumber(source.longitude),
      takenAt: source.takenAt || null,
      width: normalizeNumber(source.width),
      height: normalizeNumber(source.height),
    }
  }

  function normalizeHighlightMedia(source: HighlightFormState): Pick<CreateHighlightInput, 'variants' | 'metadata'> {
    return { variants: source.variants || {}, metadata: source.metadata || null }
  }

  function isFormValid(source: HighlightFormState) {
    return Boolean(source.imageUrl
      && source.countryId
      && source.geoPlaceId)
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
      toast.error('Заполни фото, страну и выбери город из справочника.')

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
        const success = await uploadHighlightImage(editFormFile.value, editForm, editFormFile)

        if (!success)
          return
      }

      await useRequest({
        key: EHighlightsKeys.UPDATE,
        fn: db => db.user.updateHighlight({ id: editingHighlight.value!.id, ...normalizeForm(editForm) }),
        onSuccess: (updatedHighlight) => {
          highlights.value = highlights.value.map((highlight: Highlight) => highlight.id === updatedHighlight.id ? updatedHighlight : highlight)
          editingHighlight.value = updatedHighlight
          isEditModalOpen.value = false
          toast.success('Фото обновлено.')
        },
        onError: (err: RequestError) => {
          toast.error(err.error?.customMessage || 'Не удалось обновить фото.')
        },
      })
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
    selectedCityIds,
    selectedCityRefs,
    setSelectedCityRefs,
    dateRange,
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
