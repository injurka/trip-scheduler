import type { Country } from '~/shared/types/models/destination-review'
import type { TripImage } from '~/shared/types/models/trip'
import type { CreateHighlightInput, Highlight } from '~/shared/types/models/user'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { useConfirm } from '~/shared/composables/use-confirm'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'

enum EHighlightsKeys {
  FETCH = 'highlights:fetch',
  FETCH_COUNTRIES = 'highlights:fetch-countries',
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

export function useHighlights() {
  const authStore = useAuthStore()
  const route = useRoute()
  const toast = useToast()
  const confirm = useConfirm()

  const userId = computed(() => route.params.id as string || authStore.user?.id || '')

  const highlights = ref<Highlight[]>([])
  const countries = ref<Country[]>([])
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
    target.latitude = data.latitude ?? null
    target.longitude = data.longitude ?? null
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

    await uploadHighlightImage(file, form, formFile)
  }

  async function handleEditFileSelect(file: File | null) {
    if (!file) {
      editFormFile.value = null
      restoreOriginalEditImage()
      return
    }

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
    await fetchCountries()
    isCreateModalOpen.value = true
  }

  async function openEditModal(highlight: Highlight) {
    await fetchCountries()
    editingHighlight.value = highlight
    fillEditForm(highlight)
    editFormFile.value = null
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

    // Заглушка, если API не готово
    // await useRequest({
    //   key: EHighlightsKeys.UPDATE,
    //   fn: db => db.user.updateHighlight(editingHighlight.value!.id, normalizeForm(editForm)),
    //   onSuccess: async () => {
    //     toast.success('Изменения сохранены.')
    //     isEditModalOpen.value = false
    //     setTimeout(() => resetEditForm(), 300)
    //     await fetchHighlights()
    //   },
    //   onError: (error: any) => {
    //     toast.error(error?.customMessage || 'Не удалось обновить фото.')
    //   },
    // })
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
