<script setup lang="ts">
import type { GeoPlaceKind, GeoPlaceRef, GeoPlaceSearchResult } from '~/shared/types/models/geo-place'
import { Icon } from '@iconify/vue'
import { useRequest } from '~/plugins/request'

type GeoPlaceSelection = GeoPlaceRef | GeoPlaceRef[] | null

interface Props {
  modelValue: GeoPlaceSelection
  fallbackLabel?: string
  label?: string
  placeholder?: string
  multiple?: boolean
  kinds?: GeoPlaceKind[]
  countryId?: string
  countryCode?: string
  disabled?: boolean
  icon?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  fallbackLabel: '',
  label: '',
  placeholder: 'Найти город',
  multiple: false,
  kinds: () => ['settlement'],
  countryId: undefined,
  countryCode: undefined,
  disabled: false,
  icon: undefined,
  size: 'md',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: GeoPlaceSelection): void
}>()

const rootElement = ref<HTMLElement | null>(null)
const inputElement = ref<HTMLInputElement | null>(null)
const query = ref('')
const results = ref<GeoPlaceSearchResult[]>([])
const isOpen = ref(false)
const isLoading = ref(false)
const searchError = ref(false)
const activeIndex = ref(-1)
const requestSequence = ref(0)
const requestKey = `geo-place-picker:${Math.random().toString(36).slice(2)}`
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const selectedPlaces = computed((): GeoPlaceRef[] => {
  if (Array.isArray(props.modelValue))
    return props.modelValue
  return props.modelValue ? [props.modelValue] : []
})

const selectedPlaceIds = computed(() => new Set(selectedPlaces.value.map(place => place.id)))
const displayValue = computed(() => {
  if (!props.multiple && !query.value)
    return selectedPlaces.value[0]?.name || props.fallbackLabel || ''
  return query.value
})

watch([query, () => props.countryId, () => props.countryCode, () => props.kinds], () => {
  if (debounceTimer)
    clearTimeout(debounceTimer)

  const currentQuery = query.value.trim()
  const sequence = ++requestSequence.value
  searchError.value = false
  activeIndex.value = -1

  if (currentQuery.length < 2) {
    results.value = []
    isLoading.value = false
    return
  }

  isOpen.value = true
  isLoading.value = true
  debounceTimer = setTimeout(() => void searchPlaces(currentQuery, sequence), 250)
})

async function searchPlaces(searchQuery: string, sequence: number) {
  const response = await useRequest({
    key: requestKey,
    force: true,
    cancelPrevious: true,
    fn: db => db.geo.searchPlaces({
      query: searchQuery,
      countryId: props.countryId || undefined,
      countryCode: props.countryCode,
      kinds: props.kinds,
      locale: 'ru',
      limit: 15,
    }),
    onError: () => {
      if (sequence === requestSequence.value)
        searchError.value = true
    },
  })

  if (sequence !== requestSequence.value)
    return

  results.value = response ?? []
  isLoading.value = false
}

function onFocus() {
  isOpen.value = true
  if (!props.multiple && (selectedPlaces.value.length > 0 || props.fallbackLabel)) {
    query.value = ''
    nextTick(() => inputElement.value?.select())
  }
}

function onInput(value: string) {
  query.value = value
  isOpen.value = true
}

function emitSelection(places: GeoPlaceRef[]) {
  emit('update:modelValue', props.multiple ? places : places[0] ?? null)
}

function selectPlace(place: GeoPlaceRef) {
  if (props.multiple) {
    if (!selectedPlaceIds.value.has(place.id))
      emitSelection([...selectedPlaces.value, place])
  }
  else {
    emitSelection([place])
    isOpen.value = false
  }

  query.value = ''
  results.value = []
  activeIndex.value = -1
  inputElement.value?.focus()
}

function removePlace(placeId: string) {
  emitSelection(selectedPlaces.value.filter(place => place.id !== placeId))
  inputElement.value?.focus()
}

function clearSingleSelection() {
  emitSelection([])
  query.value = ''
  isOpen.value = true
  inputElement.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
    return
  }

  if (event.key === 'ArrowDown' && results.value.length > 0) {
    event.preventDefault()
    isOpen.value = true
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)
  }
  else if (event.key === 'ArrowUp' && results.value.length > 0) {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  }
  else if (event.key === 'Enter' && isOpen.value && activeIndex.value >= 0) {
    event.preventDefault()
    const place = results.value[activeIndex.value]
    if (place)
      selectPlace(place)
  }
  else if (event.key === 'Backspace' && props.multiple && !query.value && selectedPlaces.value.length > 0) {
    removePlace(selectedPlaces.value[selectedPlaces.value.length - 1]!.id)
  }
}

function onFocusout(event: FocusEvent) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && rootElement.value?.contains(nextTarget))
    return

  isOpen.value = false
}

function placeContext(place: GeoPlaceRef) {
  return [place.regionName, place.countryName].filter(Boolean).join(' · ')
}

onBeforeUnmount(() => {
  if (debounceTimer)
    clearTimeout(debounceTimer)
  requestSequence.value++
})
</script>

<template>
  <div ref="rootElement" class="geo-place-picker" @focusout="onFocusout">
    <label v-if="label" class="geo-place-picker__label">{{ label }}</label>

    <div
      class="geo-place-picker__control"
      :class="[
        `geo-place-picker__control--${size}`,
        { 'is-open': isOpen, 'is-disabled': disabled, 'has-icon': !!icon },
      ]"
    >
      <Icon v-if="icon" :icon="icon" class="geo-place-picker__icon" />

      <div v-if="multiple" class="geo-place-picker__selected">
        <span v-for="place in selectedPlaces" :key="place.id" class="geo-place-picker__chip">
          {{ place.name }}
          <button
            type="button"
            :aria-label="`Удалить ${place.name}`"
            :disabled="disabled"
            @click="removePlace(place.id)"
          >
            <Icon icon="mdi:close-circle" />
          </button>
        </span>
      </div>

      <input
        ref="inputElement"
        :value="displayValue"
        :placeholder="placeholder"
        :disabled="disabled"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        @focus="onFocus"
        @input="onInput(($event.target as HTMLInputElement).value)"
        @keydown="onKeydown"
      >

      <button
        v-if="!multiple && (selectedPlaces.length > 0 || fallbackLabel)"
        type="button"
        class="geo-place-picker__clear"
        aria-label="Очистить выбранный город"
        :disabled="disabled"
        @click="clearSingleSelection"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>

    <div v-if="isOpen" class="geo-place-picker__menu" role="listbox">
      <div v-if="isLoading" class="geo-place-picker__message">
        Поиск городов…
      </div>
      <div v-else-if="searchError" class="geo-place-picker__message is-error">
        Не удалось загрузить справочник городов.
      </div>
      <div v-else-if="query.trim().length < 2" class="geo-place-picker__message">
        Введите не менее двух символов.
      </div>
      <div v-else-if="results.length === 0" class="geo-place-picker__message">
        Город не найден. Можно выбрать только вариант из справочника.
      </div>
      <template v-else>
        <button
          v-for="(place, index) in results"
          :key="place.id"
          type="button"
          role="option"
          :aria-selected="selectedPlaceIds.has(place.id)"
          class="geo-place-picker__option"
          :class="{ 'is-active': activeIndex === index, 'is-selected': selectedPlaceIds.has(place.id) }"
          :disabled="selectedPlaceIds.has(place.id)"
          @mouseenter="activeIndex = index"
          @click="selectPlace(place)"
        >
          <span class="geo-place-picker__option-main">
            <strong>{{ place.matchedName }}</strong>
            <span v-if="place.name !== place.matchedName">{{ place.name }}</span>
          </span>
          <small>{{ placeContext(place) }}</small>
        </button>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.geo-place-picker {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.geo-place-picker__label {
  color: var(--fg-secondary-color);
  font-size: 0.875rem;
  font-weight: 500;
}

.geo-place-picker__control {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 46px;
  padding: 6px 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  transition: border-color 0.2s;

  &--sm {
    min-height: 38px;
    padding: 4px 10px;

    &.has-icon {
      padding-left: 36px;
    }

    .geo-place-picker__icon {
      left: 10px;
      font-size: 1.125rem;
    }

    input {
      font-size: 0.875rem;
      padding: 4px 0;
    }

    .geo-place-picker__chip {
      padding: 2px 6px;
      font-size: 0.8125rem;
    }
  }

  &--md {
    min-height: 46px;
    padding: 6px 12px;

    &.has-icon {
      padding-left: 40px;
    }

    .geo-place-picker__icon {
      left: 12px;
      font-size: 1.25rem;
    }

    input {
      font-size: 1rem;
      padding: 4px 0;
    }
  }

  &--lg {
    min-height: 54px;
    padding: 8px 14px;

    &.has-icon {
      padding-left: 44px;
    }

    .geo-place-picker__icon {
      left: 14px;
      font-size: 1.375rem;
    }

    input {
      font-size: 1.125rem;
      padding: 4px 0;
    }
  }

  &.is-open,
  &:focus-within {
    border-color: var(--border-focus-color);
  }

  &.is-disabled {
    opacity: 0.7;
  }

  input {
    flex: 1 1 120px;
    min-width: 80px;
    color: var(--fg-primary-color);
    background: transparent;
    border: 0;
    outline: 0;
    font: inherit;
    font-size: 1rem;
    line-height: 1.25;
  }
}

.geo-place-picker__icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fg-tertiary-color);
  pointer-events: none;
  z-index: 1;
}

.geo-place-picker__selected {
  display: contents;
}

.geo-place-picker__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 7px 4px 10px;
  border-radius: 999px;
  color: var(--fg-primary-color);
  background: var(--bg-primary-color);
  font-size: 0.9rem;

  button,
  .geo-place-picker__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: var(--fg-secondary-color);
    background: transparent;
    border: 0;
    cursor: pointer;
    font-size: 1rem;
  }
}

.geo-place-picker__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  color: var(--fg-secondary-color);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.geo-place-picker__menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 280px;
  overflow: auto;
  padding: 5px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
}

.geo-place-picker__option {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 2px;
  padding: 9px 10px;
  color: var(--fg-primary-color);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: calc(var(--r-s) / 2);
  cursor: pointer;

  &:hover,
  &.is-active {
    background: var(--bg-secondary-color);
  }

  &.is-selected {
    opacity: 0.55;
    cursor: default;
  }

  small {
    color: var(--fg-tertiary-color);
    font-size: 0.75rem;
  }
}

.geo-place-picker__option-main {
  display: flex;
  align-items: baseline;
  gap: 6px;

  span {
    color: var(--fg-secondary-color);
    font-size: 0.82rem;
  }
}

.geo-place-picker__message {
  padding: 11px 10px;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;

  &.is-error {
    color: var(--fg-error-color);
  }
}
</style>
