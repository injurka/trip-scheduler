<script setup lang="ts" generic="T extends string | number | object">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import { Icon } from '@iconify/vue'
// --- Новые импорты ---
import { onClickOutside, useElementBounding, useWindowSize } from '@vueuse/core'
import { nextTick, ref, watch } from 'vue'
// --- Конец новых импортов ---
import { KitInput } from '~/components/01.kit/kit-input'

const props = withDefaults(defineProps<{
  modelValue: T | T[] | null
  items: KitDropdownItem<T>[]
  label?: string
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  loading?: boolean
  multiple?: boolean
  creatable?: boolean
  icon?: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  label: '',
  placeholder: 'Выберите значение...',
  disabled: false,
  clearable: true,
  loading: false,
  multiple: false,
  creatable: false,
  icon: undefined,
  size: 'md',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: T | T[] | null): void
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<InstanceType<typeof KitInput> | null>(null)
const isOpen = ref(false)
const searchQuery = ref('')

// --- Новое состояние и логика для определения направления открытия ---
const openDirection = ref<'down' | 'up'>('down')
const DROPDOWN_MIN_HEIGHT = 250 // Примерная минимальная высота выпадающего списка
const { height: windowHeight } = useWindowSize()
const { bottom: wrapperBottom, top: wrapperTop } = useElementBounding(wrapperRef)

watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    // Ждем следующего тика, чтобы DOM обновился и wrapperRef был доступен
    nextTick(() => {
      const spaceBelow = windowHeight.value - wrapperBottom.value
      const spaceAbove = wrapperTop.value

      // Если внизу места мало, а вверху больше - открываем вверх
      if (spaceBelow < DROPDOWN_MIN_HEIGHT && spaceAbove > spaceBelow) {
        openDirection.value = 'up'
      }
      else {
        openDirection.value = 'down'
      }
    })
  }
})
// --- Конец новой логики ---

const selectedItems = computed(() => {
  if (!props.modelValue)
    return []

  const modelValues = (Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]) as any[]

  return modelValues
    .map((value) => {
      const existingItem = props.items.find(item => item.value === value)
      return existingItem || { value, label: String(value) }
    })
    .filter(item => item.label)
})

const singleSelectedItemLabel = computed(() => {
  if (props.multiple || !props.modelValue)
    return ''

  return props.items.find(item => item.value === props.modelValue)?.label || ''
})

watch(singleSelectedItemLabel, (newLabel) => {
  if (!isOpen.value)
    searchQuery.value = newLabel
}, { immediate: true })

const filteredItems = computed(() => {
  if (!searchQuery.value)
    return props.items

  return props.items.filter(item =>
    item.label.toLowerCase().includes(searchQuery.value.toLowerCase()),
  )
})

function handleOpen() {
  if (props.disabled || isOpen.value)
    return

  isOpen.value = true

  if (!props.multiple)
    searchQuery.value = ''

  nextTick(() => {
    ;(searchInputRef.value?.$el as HTMLInputElement)?.focus()
  })
}

function handleClose() {
  if (!isOpen.value)
    return

  isOpen.value = false

  if (!props.multiple)
    searchQuery.value = singleSelectedItemLabel.value
  else
    searchQuery.value = ''
}

function toggleDropdown() {
  if (isOpen.value)
    handleClose()
  else
    handleOpen()
}

function selectItem(item: KitDropdownItem<T>) {
  if (props.multiple) {
    const model = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const index = model.findIndex(v => v === item.value)
    if (index === -1)
      model.push(item.value)

    emit('update:modelValue', model)
    searchQuery.value = ''
  }
  else {
    emit('update:modelValue', item.value)
    handleClose()
  }
}

function removeItem(itemValue: T) {
  if (!props.multiple || !Array.isArray(props.modelValue))
    return
  const model = props.modelValue.filter(v => v !== itemValue)
  emit('update:modelValue', model)
}

function clearSelection() {
  emit('update:modelValue', props.multiple ? [] : null)
  searchQuery.value = ''
  handleOpen()
}

function isSelected(item: KitDropdownItem<T>): boolean {
  if (props.multiple)
    return Array.isArray(props.modelValue) && props.modelValue.includes(item.value)

  return props.modelValue === item.value
}

function handleAddNewItem() {
  if (!props.creatable || !props.multiple || !searchQuery.value.trim())
    return

  const newValue = searchQuery.value.trim()
  const model = (Array.isArray(props.modelValue) ? [...props.modelValue] : []) as string[]

  if (!model.some(v => String(v).toLowerCase() === newValue.toLowerCase())) {
    model.push(newValue)
    emit('update:modelValue', model as any)
  }
  searchQuery.value = ''
}

onClickOutside(wrapperRef, handleClose)
</script>

<template>
  <div ref="wrapperRef" class="kit-select-with-search" :class="{ 'is-disabled': disabled }">
    <label v-if="label" @click="toggleDropdown">{{ label }}</label>

    <!-- Режим с чипами (multiple) -->
    <div
      v-if="multiple"
      class="chip-input-wrapper"
      :class="[
        `kit-input-${size}`,
        { 'is-focused': isOpen, 'has-icon': !!icon },
      ]"
      @click="handleOpen"
    >
      <Icon v-if="icon" :icon="icon" class="main-icon" />
      <div v-for="item in selectedItems" :key="String(item.value)" class="chip">
        <span>{{ item.label }}</span>
        <Icon icon="mdi:close-circle" class="chip-remove-icon" @click.stop="removeItem(item.value)" />
      </div>
      <input
        v-if="isOpen || selectedItems.length === 0"
        ref="searchInputRef"
        v-model="searchQuery"
        :placeholder="selectedItems.length === 0 ? placeholder : ''"
        :disabled="disabled"
        class="search-input"
        autocomplete="off"
        @focus="handleOpen"
        @click.stop="handleOpen"
        @keydown.enter.prevent="handleAddNewItem"
      >
      <button
        v-if="clearable && selectedItems.length > 0 && !disabled"
        class="clear-btn"
        aria-label="Очистить выбор"
        @click.stop="clearSelection"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>

    <!-- Одиночный режим -->
    <div v-else class="input-wrapper">
      <KitInput
        ref="searchInputRef"
        v-model="searchQuery"
        :placeholder="placeholder"
        :disabled="disabled"
        :icon="icon"
        :size="size"
        autocomplete="off"
        @focus="handleOpen"
        @click="handleOpen"
      />
      <button
        v-if="clearable && modelValue !== null && !disabled"
        class="clear-btn"
        aria-label="Очистить выбор"
        @click.stop="clearSelection"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>

    <!-- Общий выпадающий список -->
    <Transition name="fade-dropdown">
      <!-- --- Добавлен класс is-open-up --- -->
      <div
        v-if="isOpen"
        class="dropdown-panel"
        :class="{ 'is-open-up': openDirection === 'up' }"
      >
        <ul v-if="filteredItems.length > 0 && !loading" class="dropdown-list">
          <li
            v-for="item in filteredItems"
            :key="String(item.value)"
            class="dropdown-item"
            :class="{ 'is-active': isSelected(item), 'is-disabled': multiple && isSelected(item) }"
            @mousedown.prevent="selectItem(item)"
          >
            <slot name="item" :item="item">
              <Icon v-if="item.icon" :icon="item.icon" class="item-icon" />
              <span>{{ item.label }}</span>
            </slot>
            <Icon v-if="multiple && isSelected(item)" icon="mdi:check" class="item-check-icon" />
          </li>
        </ul>
        <div v-else-if="loading" class="dropdown-state">
          Загрузка...
        </div>
        <div v-else class="dropdown-state">
          Ничего не найдено
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.kit-select-with-search {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    cursor: pointer;
  }
}

.input-wrapper {
  position: relative;
}

.clear-btn {
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
  border-radius: 50%;
  z-index: 3;

  &:hover {
    color: var(--fg-primary-color);
    background-color: var(--bg-hover-color);
  }
}

.dropdown-panel {
  position: absolute;
  width: 100%;
  max-height: 250px;
  overflow-y: auto;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: var(--r-m);
  z-index: 100;
  box-shadow: var(--s-l);
  // --- Изменения стилей для позиционирования ---
  top: calc(100% + 4px); // По умолчанию открывается вниз

  &.is-open-up {
    top: auto; // Сбрасываем top
    bottom: calc(100% + 4px); // Позиционируем снизу
  }
  // --- Конец изменений ---
}

.dropdown-list {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--r-s);
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.95rem;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &.is-active {
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

.item-icon {
  font-size: 1.1rem;
  color: var(--fg-secondary-color);
}

.item-check-icon {
  margin-left: auto;
  font-size: 1.1rem;
}

.dropdown-state {
  padding: 16px;
  text-align: center;
  color: var(--fg-secondary-color);
}

.chip-input-wrapper {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  cursor: text;
  transition: border-color 0.2s;
  position: relative;

  &.has-icon {
    padding-left: 40px;
  }

  &.is-focused {
    border-color: var(--border-focus-color);
  }

  .main-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--fg-tertiary-color);
    font-size: 1.25rem;
  }

  .search-input {
    flex-grow: 1;
    border: none;
    background: none;
    outline: none;
    color: var(--fg-primary-color);
    min-width: 120px;
    padding: 4px 0;
  }
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: var(--bg-accent-color);
  color: var(--fg-on-accent-color);
  border-radius: var(--r-s);
  font-weight: 500;

  .chip-remove-icon {
    cursor: pointer;
    font-size: 1rem;
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
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
  transform: translateY(-5px); // По умолчанию анимация вниз
}

// --- Новые стили для анимации вверх ---
.is-open-up.fade-dropdown-enter-from,
.is-open-up.fade-dropdown-leave-to {
  transform: translateY(5px);
}
// --- Конец новых стилей ---

.chip-input-wrapper {
  &.kit-input-sm {
    min-height: 38px;
    padding: 4px 36px 4px 10px;
    font-size: 0.875rem;

    &.has-icon {
      padding-left: 36px;
    }
    .main-icon {
      left: 10px;
      font-size: 1.125rem;
    }
    .search-input {
      font-size: 0.875rem;
    }
    .chip {
      padding: 2px 6px;
      font-size: 0.8125rem;
    }
  }

  &.kit-input-md {
    min-height: 46px;
    padding: 6px 40px 6px 12px;
    font-size: 1rem;

    &.has-icon {
      padding-left: 40px;
    }
    .main-icon {
      left: 12px;
      font-size: 1.25rem;
    }
    .search-input {
      font-size: 1rem;
    }
    .chip {
      padding: 4px 8px;
      font-size: 0.875rem;
    }
  }

  &.kit-input-lg {
    min-height: 54px;
    padding: 8px 44px 8px 14px;
    font-size: 1.125rem;

    &.has-icon {
      padding-left: 44px;
    }
    .main-icon {
      left: 14px;
      font-size: 1.375rem;
    }
    .search-input {
      font-size: 1.125rem;
    }
    .chip {
      padding: 6px 10px;
      font-size: 1rem;
    }
  }
}
</style>
