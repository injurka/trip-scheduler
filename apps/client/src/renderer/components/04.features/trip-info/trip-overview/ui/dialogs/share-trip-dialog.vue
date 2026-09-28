<script setup lang="ts">
import type { Trip } from '~/shared/types/models/trip'
import { useClipboard, useDebounceFn, useShare } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { AppRoutePaths } from '~/shared/constants/routes'

interface Props {
  visible: boolean
  trip: Trip
  initialSlug: string
  canEdit: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const toast = useToast()
const { share, isSupported: isShareSupported } = useShare()
const { copy } = useClipboard()
const slug = ref('')
const isChecking = ref(false)
const isAvailable = ref<boolean | null>(null)
const availabilityError = ref('')
const checkSequence = ref(0)

const slugPattern = /^(?![\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$)[a-z0-9]+(?:-[a-z0-9]+)*$/i
const isSlugValid = computed(() => slug.value.length >= 3 && slug.value.length <= 80 && slugPattern.test(slug.value))
const saveRequestKey = computed(() => `trip-share:update:${props.trip.id}`)
const isSaving = useRequestStatus(saveRequestKey)
const shareUrl = computed(() => new URL(AppRoutePaths.Trip.Info(slug.value || props.initialSlug), window.location.origin).toString())
const inputError = computed(() => {
  if (slug.value && !isSlugValid.value)
    return 'От 3 до 80 символов: латиница в нижнем регистре, цифры и дефисы между словами.'
  if (isAvailable.value === false)
    return 'Этот адрес уже занят. Попробуйте другой.'
  return availabilityError.value || null
})

async function checkAvailability(value: string) {
  if (!slugPattern.test(value) || value.length < 3 || value.length > 80) {
    isAvailable.value = null
    isChecking.value = false
    return
  }

  const sequence = ++checkSequence.value
  isChecking.value = true
  availabilityError.value = ''
  const available = await useRequest({
    key: `trip-share:check:${props.trip.id}:${value}`,
    fn: db => db.trips.isShareSlugAvailable(props.trip.id, value),
    onError: () => {
      if (sequence === checkSequence.value)
        availabilityError.value = 'Не удалось проверить адрес. Повторите попытку.'
    },
  })

  if (sequence !== checkSequence.value)
    return

  isChecking.value = false
  isAvailable.value = typeof available === 'boolean' ? available : null
}

const debouncedCheckAvailability = useDebounceFn(checkAvailability, 350)

watch(slug, (value) => {
  const normalized = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (normalized !== value) {
    slug.value = normalized
    return
  }

  isAvailable.value = null
  availabilityError.value = ''
  if (isSlugValid.value) {
    debouncedCheckAvailability(value)
  }
  else {
    isChecking.value = false
  }
})

watch(() => props.visible, (visible) => {
  if (!visible) {
    checkSequence.value++
    return
  }

  slug.value = props.initialSlug
})

async function handleShare() {
  if (!isSlugValid.value || isAvailable.value !== true || isChecking.value)
    return

  if (props.canEdit && slug.value !== props.initialSlug) {
    const savedTrip = await useRequest({
      key: `trip-share:update:${props.trip.id}`,
      fn: db => db.trips.update(props.trip.id, { shareSlug: slug.value }),
      onError: ({ error }) => {
        const message = (error as unknown as Error).message || 'Не удалось сохранить адрес ссылки.'
        availabilityError.value = message
        toast.error(message)
      },
    })

    if (!savedTrip)
      return
  }

  const data = {
    title: props.trip.title || 'Путешествие',
    text: props.trip.description || `Взгляните на план путешествия «${props.trip.title}»`,
    url: shareUrl.value,
  }

  if (isShareSupported.value) {
    try {
      await share(data)
    }
    catch (error) {
      if ((error as Error)?.name === 'AbortError')
        return
      await copy(data.url)
      toast.success('Ссылка скопирована в буфер обмена')
    }
  }
  else {
    await copy(data.url)
    toast.success('Ссылка скопирована в буфер обмена')
  }

  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Поделиться путешествием"
    icon="mdi:link-variant"
    description="Настройте короткий адрес для ссылки на путешествие."
    :max-width="480"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="share-dialog-content">
      <KitInput
        v-model="slug"
        label="Красивая ссылка"
        placeholder="например, taiwan-2026"
        :error="inputError"
        :disabled="!canEdit"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
      />
      <p class="share-url-preview">
        {{ shareUrl }}
      </p>
      <p v-if="isChecking" class="availability-message" role="status">
        Проверяем доступность…
      </p>
      <p v-else-if="isAvailable && isSlugValid" class="availability-message availability-message--available" role="status">
        Адрес свободен
      </p>
      <p v-else-if="isAvailable === false" class="availability-message availability-message--taken" role="status">
        Адрес уже занят
      </p>
    </div>
    <template #footer>
      <KitBtn variant="text" @click="emit('update:visible', false)">
        Отмена
      </KitBtn>
      <KitBtn
        icon="mdi:share-variant-outline"
        :disabled="!isSlugValid || isAvailable !== true || isChecking || isSaving"
        @click="handleShare"
      >
        Поделиться
      </KitBtn>
    </template>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.share-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
}

.share-url-preview {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--fg-tertiary-color);
  font-size: 0.8125rem;
}

.availability-message {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.8125rem;

  &--available {
    color: var(--success-color, #2e9b65);
  }

  &--taken {
    color: var(--error-color, #d14a4a);
  }
}
</style>
