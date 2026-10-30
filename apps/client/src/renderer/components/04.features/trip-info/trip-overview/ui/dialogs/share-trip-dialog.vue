<script setup lang="ts">
import type { Trip } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { useClipboard, useDebounceFn, useShare } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { useRequest, useRequestStatus } from '~/plugins/request'
import { getTripDeepLinkUrl, getTripWebUrl } from '~/shared/lib/deep-link'

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
const debouncedCheckAvailability = useDebounceFn(checkAvailability, 350)

const slug = ref('')
const isChecking = ref(false)
const isAvailable = ref<boolean | null>(null)
const availabilityError = ref('')
const checkSequence = ref(0)
const slugPattern = /^(?![\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$)[a-z0-9]+(?:-[a-z0-9]+)*$/i

const isSlugValid = computed(() => slug.value.length >= 3 && slug.value.length <= 80 && slugPattern.test(slug.value))
const saveRequestKey = computed(() => `trip-share:update:${props.trip.id}`)

const isSaving = useRequestStatus(saveRequestKey)

const activeSlug = computed(() => slug.value || props.initialSlug)
const shareUrl = computed(() => getTripWebUrl(activeSlug.value))
const deepLinkUrl = computed(() => getTripDeepLinkUrl(activeSlug.value))
const inputError = computed(() => {
  if (slug.value && !isSlugValid.value)
    return 'От 3 до 80 символов: латиница в нижнем регистре, цифры и дефисы между словами.'

  if (isAvailable.value === false)
    return 'Этот адрес уже занят. Попробуйте другой.'

  return availabilityError.value || null
})

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

async function copyWebUrl() {
  await copy(shareUrl.value)
  toast.success('Ссылка на сайт скопирована')
}
async function copyDeepLinkUrl() {
  await copy(deepLinkUrl.value)
  toast.success('Deep link скопирован')
}
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

async function persistShareSlugIfChanged(): Promise<boolean> {
  if (!props.canEdit || slug.value === props.initialSlug)
    return true

  const savedTrip = await useRequest({
    key: `trip-share:update:${props.trip.id}`,
    fn: db => db.trips.update(props.trip.id, { shareSlug: slug.value }),
    onError: ({ error }) => {
      const message = (error as unknown as Error).message || 'Не удалось сохранить адрес ссылки.'
      availabilityError.value = message
      toast.error(message)
    },
  })

  return Boolean(savedTrip)
}

async function shareOrCopyUrl(data: { title: string, text: string, url: string }): Promise<boolean> {
  if (isShareSupported.value) {
    try {
      await share(data)

      return true
    }
    catch (error) {
      if ((error as Error)?.name === 'AbortError')
        return false
    }
  }

  await copy(data.url)
  toast.success('Ссылка скопирована в буфер обмена')

  return true
}

async function handleShare() {
  if (!isSlugValid.value || isAvailable.value !== true || isChecking.value)
    return

  if (!await persistShareSlugIfChanged())
    return

  const data = {
    title: props.trip.title || 'Путешествие',
    text: props.trip.description || `Взгляните на план путешествия «${props.trip.title}»`,
    url: shareUrl.value,
  }

  if (!await shareOrCopyUrl(data))
    return

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
      <p v-if="isChecking" class="availability-message" role="status">
        Проверяем доступность…
      </p>
      <p v-else-if="isAvailable && isSlugValid" class="availability-message availability-message--available" role="status">
        Адрес свободен
      </p>
      <p v-else-if="isAvailable === false" class="availability-message availability-message--taken" role="status">
        Адрес уже занят
      </p>

      <div class="share-links-group">
        <div class="share-link-card">
          <div class="share-link-header">
            <div class="share-link-label">
              <Icon icon="mdi:web" class="link-icon" />
              <span>Ссылка на сайт</span>
            </div>
            <KitBtn
              variant="text"
              size="xs"
              icon="mdi:content-copy"
              @click="copyWebUrl"
            >
              Копировать
            </KitBtn>
          </div>
          <p class="share-url-preview">
            {{ shareUrl }}
          </p>
        </div>

        <div class="share-link-card">
          <div class="share-link-header">
            <div class="share-link-label">
              <Icon icon="mdi:cellphone-link" class="link-icon" />
              <span>Deep Link (приложение)</span>
            </div>
            <KitBtn
              variant="text"
              size="xs"
              icon="mdi:content-copy"
              @click="copyDeepLinkUrl"
            >
              Копировать
            </KitBtn>
          </div>
          <p class="share-url-preview">
            {{ deepLinkUrl }}
          </p>
        </div>
      </div>
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
  color: var(--fg-primary-color);
  font-size: 0.8125rem;
  font-family: monospace;
}

.share-links-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.share-link-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background-color: rgba(var(--bg-secondary-color-rgb), 0.5);
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.2);
  border-radius: 8px;
}

.share-link-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.share-link-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.link-icon {
  font-size: 0.95rem;
  color: var(--accent-primary-color);
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
