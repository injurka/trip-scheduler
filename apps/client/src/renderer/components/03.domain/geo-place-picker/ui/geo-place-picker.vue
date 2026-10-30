<script setup lang="ts">
import type { GeoPlaceKind, GeoPlaceRef, GeoPlaceSearchResult } from '~/shared/types/models/geo-place'
import { Icon } from '@iconify/vue'
import { onClickOutside, useElementBounding, useWindowSize } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
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
  clearable?: boolean
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
  clearable: true,
  icon: undefined,
  size: 'md',
})
const emit = defineEmits<{
  (event: 'update:modelValue', value: GeoPlaceSelection): void
}>()

const { height: windowHeight } = useWindowSize()

const rootElement = ref<HTMLElement | null>(null)

const { bottom: wrapperBottom, top: wrapperTop } = useElementBounding(rootElement)

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
const openDirection = ref<'down' | 'up'>('down')
const DROPDOWN_MIN_HEIGHT = 250

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

watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    nextTick(() => {
      const spaceBelow = windowHeight.value - wrapperBottom.value
      const spaceAbove = wrapperTop.value

      if (spaceBelow < DROPDOWN_MIN_HEIGHT && spaceAbove > spaceBelow) {
        openDirection.value = 'up'
      }
      else {
        openDirection.value = 'down'
      }
    })
  }
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
  if (props.disabled || isOpen.value)
    return

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
function clearSelection() {
  emitSelection([])
  query.value = ''
  results.value = []
  isOpen.value = false
  inputElement.value?.focus()
}
function handleArrowNavigation(event: KeyboardEvent): boolean {
  if (event.key === 'ArrowDown' && results.value.length > 0) {
    event.preventDefault()
    isOpen.value = true
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)

    return true
  }

  if (event.key === 'ArrowUp' && results.value.length > 0) {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)

    return true
  }

  return false
}

function handleEnterSelection(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' || !isOpen.value || activeIndex.value < 0)
    return false

  event.preventDefault()
  const place = results.value[activeIndex.value]

  if (place)
    selectPlace(place)

  return true
}

function handleBackspaceRemoval(event: KeyboardEvent): void {
  if (event.key === 'Backspace' && props.multiple && !query.value && selectedPlaces.value.length > 0)
    removePlace(selectedPlaces.value[selectedPlaces.value.length - 1]!.id)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose()

    return
  }

  if (handleArrowNavigation(event) || handleEnterSelection(event))
    return

  handleBackspaceRemoval(event)
}
function handleClose() {
  if (!isOpen.value)
    return

  isOpen.value = false
  query.value = ''
  results.value = []
  activeIndex.value = -1
}
function placeContext(place: GeoPlaceRef) {
  return [place.regionName, place.countryName].filter(Boolean).join(' · ')
}

onClickOutside(rootElement, handleClose)

onBeforeUnmount(() => {
  if (debounceTimer)
    clearTimeout(debounceTimer)

  requestSequence.value++
})
</script>

<template>
  <div ref="rootElement" class="geo-place-picker" :class="{ 'is-disabled': disabled }">
    <label v-if="label" class="geo-place-picker__label" @click="inputElement?.focus()">{{ label }}</label>

    <div
      class="geo-place-picker__control"
      :class="[
        `geo-place-picker__control--${size}`,
        {
          'is-open': isOpen,
          'is-disabled': disabled,
          'has-icon': !!icon,
          'has-clear': clearable && !disabled && (multiple ? selectedPlaces.length > 0 : (selectedPlaces.length > 0 || !!fallbackLabel)),
          'is-multiple': multiple,
        },
      ]"
      @click="inputElement?.focus()"
    >
      <Icon v-if="icon" :icon="icon" class="geo-place-picker__icon" />

      <div v-if="multiple && selectedPlaces.length > 0" class="geo-place-picker__chips">
        <span v-for="place in selectedPlaces" :key="place.id" class="geo-place-picker__chip">
          <span>{{ place.name }}</span>
          <button
            type="button"
            :aria-label="`Удалить ${place.name}`"
            :disabled="disabled"
            @click.stop="removePlace(place.id)"
          >
            <Icon icon="mdi:close-circle" />
          </button>
        </span>
      </div>

      <input
        ref="inputElement"
        :value="displayValue"
        :placeholder="selectedPlaces.length === 0 ? placeholder : ''"
        :disabled="disabled"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        autocomplete="off"
        class="geo-place-picker__input"
        @focus="onFocus"
        @input="onInput(($event.target as HTMLInputElement).value)"
        @keydown="onKeydown"
      >

      <button
        v-if="clearable && !disabled && (multiple ? selectedPlaces.length > 0 : (selectedPlaces.length > 0 || !!fallbackLabel))"
        type="button"
        class="geo-place-picker__clear"
        aria-label="Очистить выбор"
        @click.stop="clearSelection"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>

    <Transition name="fade-dropdown">
      <div
        v-if="isOpen"
        class="geo-place-picker__menu"
        :class="{ 'is-open-up': openDirection === 'up' }"
        role="listbox"
      >
        <div v-if="isLoading" class="geo-place-picker__state">
          <Icon icon="mdi:loading" class="spin-icon" />
          <span>Поиск городов…</span>
        </div>
        <div v-else-if="searchError" class="geo-place-picker__state is-error">
          <Icon icon="mdi:alert-circle-outline" />
          <span>Не удалось загрузить данные</span>
        </div>
        <div v-else-if="query.trim().length < 2" class="geo-place-picker__state">
          <span>Введите от 2 символов</span>
        </div>
        <div v-else-if="results.length === 0" class="geo-place-picker__state">
          <span>Ничего не найдено</span>
        </div>
        <ul v-else class="geo-place-picker__list">
          <li
            v-for="(place, index) in results"
            :key="place.id"
            role="option"
            :aria-selected="selectedPlaceIds.has(place.id)"
            class="geo-place-picker__option"
            :class="{
              'is-active': activeIndex === index,
              'is-selected': selectedPlaceIds.has(place.id),
              'is-disabled': multiple && selectedPlaceIds.has(place.id),
            }"
            @mouseenter="activeIndex = index"
            @mousedown.prevent="selectPlace(place)"
          >
            <div class="geo-place-picker__option-content">
              <div class="geo-place-picker__option-main">
                <span class="geo-place-picker__option-title">{{ place.matchedName }}</span>
                <span v-if="place.name !== place.matchedName" class="geo-place-picker__option-alias">({{ place.name }})</span>
              </div>
              <small v-if="placeContext(place)" class="geo-place-picker__option-subtitle">{{ placeContext(place) }}</small>
            </div>
            <Icon v-if="selectedPlaceIds.has(place.id)" icon="mdi:check" class="geo-place-picker__check-icon" />
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.geo-place-picker {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.is-disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.geo-place-picker__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  cursor: pointer;
}

.geo-place-picker__control {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  transition: border-color 0.2s;
  box-sizing: border-box;
  cursor: text;

  &.is-open,
  &:focus-within {
    border-color: var(--border-focus-color);
  }

  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .geo-place-picker__icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: var(--fg-tertiary-color);
    pointer-events: none;
    z-index: 1;
  }

  .geo-place-picker__input {
    flex-grow: 1;
    min-width: 80px;
    color: var(--fg-primary-color);
    background: transparent;
    border: 0;
    outline: 0;
    font-family: inherit;
    line-height: normal;
    padding: 0;

    &::placeholder {
      color: var(--fg-tertiary-color);
    }

    &:disabled {
      cursor: not-allowed;
    }
  }

  /* SIZES matching KitInput & KitSelectWithSearch exactly */
  &--sm {
    min-height: 38px;
    padding: 4px 10px;
    font-size: 0.875rem;

    &.has-icon {
      padding-left: 40px;
    }

    &.has-clear {
      padding-right: 36px;
    }

    .geo-place-picker__icon {
      left: 12px;
      font-size: 1rem;
    }

    .geo-place-picker__input {
      font-size: 0.875rem;
      min-height: 20px;
    }

    .geo-place-picker__chip {
      padding: 2px 6px;
      font-size: 0.8125rem;
    }
  }

  &--md {
    min-height: 46px;
    padding: 6px 12px;
    font-size: 1rem;

    &.has-icon {
      padding-left: 40px;
    }

    &.has-clear {
      padding-right: 40px;
    }

    .geo-place-picker__icon {
      left: 12px;
      font-size: 1rem;
    }

    .geo-place-picker__input {
      font-size: 1rem;
      min-height: 32px;
    }

    .geo-place-picker__chip {
      padding: 4px 8px;
      font-size: 0.875rem;
    }
  }

  &--lg {
    min-height: 54px;
    padding: 8px 14px;
    font-size: 1.125rem;

    &.has-icon {
      padding-left: 44px;
    }

    &.has-clear {
      padding-right: 44px;
    }

    .geo-place-picker__icon {
      left: 14px;
      font-size: 1.375rem;
    }

    .geo-place-picker__input {
      font-size: 1.125rem;
      min-height: 36px;
    }

    .geo-place-picker__chip {
      padding: 6px 10px;
      font-size: 1rem;
    }
  }

  &.is-multiple {
    padding-top: 4px;
    padding-bottom: 4px;
  }
}

.geo-place-picker__clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg-tertiary-color);
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 3;
  font-size: 1rem;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-primary-color);
    background-color: var(--bg-hover-color);
  }
}

.geo-place-picker__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.geo-place-picker__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--bg-accent-color);
  color: var(--fg-on-accent-color);
  border-radius: var(--r-s);
  font-weight: 500;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: var(--fg-on-accent-color);
    background: transparent;
    border: 0;
    cursor: pointer;
    font-size: 1rem;
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }
}

/* DROPDOWN PANEL matching KitSelectWithSearch exactly */
.geo-place-picker__menu {
  position: absolute;
  width: 100%;
  max-height: 250px;
  overflow-y: auto;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  z-index: 100;
  box-shadow: var(--s-l);
  top: calc(100% + 4px);
  box-sizing: border-box;

  &.is-open-up {
    top: auto;
    bottom: calc(100% + 4px);
  }
}

.geo-place-picker__list {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.geo-place-picker__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--r-s);
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--fg-primary-color);
  text-align: left;
  background: transparent;
  border: 0;
  width: 100%;
  box-sizing: border-box;

  &:hover,
  &.is-active {
    background-color: var(--bg-hover-color);
  }

  &.is-selected {
    background-color: var(--bg-accent-overlay-color);
    color: var(--fg-accent-color);
    font-weight: 500;
  }

  &.is-disabled {
    cursor: default;
    opacity: 0.7;
    background-color: transparent;
  }
}

.geo-place-picker__option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex-grow: 1;
}

.geo-place-picker__option-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.geo-place-picker__option-title {
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.geo-place-picker__option-alias {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.geo-place-picker__option-subtitle {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.geo-place-picker__check-icon {
  margin-left: auto;
  font-size: 1.1rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
}

.geo-place-picker__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
  color: var(--fg-secondary-color);
  font-size: 0.95rem;

  &.is-error {
    color: var(--fg-error-color);
  }

  .spin-icon {
    font-size: 1.1rem;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.fade-dropdown-enter-active,
.fade-dropdown-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-dropdown-enter-from,
.fade-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.is-open-up.fade-dropdown-enter-from,
.is-open-up.fade-dropdown-leave-to {
  transform: translateY(5px);
}
</style>
