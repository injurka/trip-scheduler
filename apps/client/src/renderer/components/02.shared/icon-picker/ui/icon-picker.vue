<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { iconCategories } from '~/shared/constants/icon-list'
import { useIconPicker } from '../composables/use-icon-picker'

interface Props {
  modelValue?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  inline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  size: 'md',
  disabled: false,
  align: 'center',
  inline: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', icon: string): void
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const adjustedAlign = ref(props.align)

const { searchQuery, activeCategoryId, filteredIcons, reset } = useIconPicker()

const ALL_ID = 'all'

const allCategoryTab = { id: ALL_ID, label: 'Все', icon: 'mdi:dots-grid' }
const categoryTabs = computed(() => [allCategoryTab, ...iconCategories])

const PANEL_WIDTH = 320
const MARGIN = 8

function updateAlignment() {
  if (!wrapperRef.value)
    return

  const vw = window.innerWidth
  const rect = wrapperRef.value.getBoundingClientRect()

  const startRight = rect.left + PANEL_WIDTH
  const endLeft = rect.right - PANEL_WIDTH
  const centerLeft = rect.left + rect.width / 2 - PANEL_WIDTH / 2
  const centerRight = centerLeft + PANEL_WIDTH

  if (props.align === 'center') {
    if (centerLeft < MARGIN)
      adjustedAlign.value = 'start'
    else if (centerRight > vw - MARGIN)
      adjustedAlign.value = 'end'
    else
      adjustedAlign.value = 'center'
  }
  else if (props.align === 'start') {
    adjustedAlign.value = startRight > vw - MARGIN ? 'end' : 'start'
  }
  else if (props.align === 'end') {
    adjustedAlign.value = endLeft < MARGIN ? 'start' : 'end'
  }
}

function open() {
  if (props.disabled)
    return
  isOpen.value = true
  nextTick(() => {
    updateAlignment()
    searchInputRef.value?.focus()
  })
}

function close() {
  isOpen.value = false
  reset()
}

function toggle() {
  isOpen.value ? close() : open()
}

function selectIcon(icon: string) {
  emit('update:modelValue', icon)
  if (!props.inline)
    close()
}

function setCategory(id: string) {
  activeCategoryId.value = id
  searchQuery.value = ''
}

function clearSearch() {
  searchQuery.value = ''
  searchInputRef.value?.focus()
}

onClickOutside(wrapperRef, () => {
  if (!props.inline)
    close()
})
</script>

<template>
  <div v-if="inline" class="icon-picker-panel is-inline">
    <div class="picker-search">
      <Icon icon="mdi:magnify" class="search-icon" />
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        class="search-input"
        placeholder="Поиск иконок..."
        type="text"
      >
      <button v-if="searchQuery" class="search-clear" @click="clearSearch">
        <Icon icon="mdi:close" />
      </button>
    </div>

    <div class="picker-categories">
      <button
        v-for="cat in categoryTabs"
        :key="cat.id"
        class="cat-chip"
        :class="{ active: activeCategoryId === cat.id }"
        @click="setCategory(cat.id)"
      >
        <Icon :icon="cat.icon" class="cat-icon" />
        <span class="cat-label">{{ cat.label }}</span>
      </button>
    </div>

    <div class="picker-grid-wrap">
      <div v-if="filteredIcons.length" class="picker-grid">
        <button
          v-for="icon in filteredIcons"
          :key="icon"
          class="icon-btn"
          :class="{ selected: icon === modelValue }"
          :title="icon.replace('mdi:', '')"
          @click="selectIcon(icon)"
        >
          <Icon :icon="icon" />
        </button>
      </div>
      <div v-else class="picker-empty">
        <Icon icon="mdi:emoticon-sad-outline" class="empty-icon" />
        <span>Иконки не найдены</span>
      </div>
    </div>
  </div>

  <div v-else ref="wrapperRef" class="icon-picker-wrapper" :class="`size-${size}`">
    <button
      class="picker-trigger"
      :class="[`size-${size}`, { disabled, active: isOpen }]"
      :disabled="disabled"
      @click="toggle"
    >
      <Icon
        :icon="modelValue || 'mdi:image-off-outline'"
        class="trigger-icon"
        :class="{ placeholder: !modelValue }"
      />
      <Icon
        icon="mdi:chevron-down"
        class="trigger-chevron"
        :class="{ rotated: isOpen }"
      />
    </button>

    <Transition name="picker-fade">
      <div
        v-if="isOpen"
        ref="panelRef"
        class="icon-picker-panel"
        :class="`align-${adjustedAlign}`"
      >
        <div class="picker-search">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            class="search-input"
            placeholder="Поиск иконок..."
            type="text"
          >
          <button v-if="searchQuery" class="search-clear" @click="clearSearch">
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div class="picker-categories">
          <button
            v-for="cat in categoryTabs"
            :key="cat.id"
            class="cat-chip"
            :class="{ active: activeCategoryId === cat.id }"
            @click="setCategory(cat.id)"
          >
            <Icon :icon="cat.icon" class="cat-icon" />
            <span class="cat-label">{{ cat.label }}</span>
          </button>
        </div>

        <div class="picker-grid-wrap">
          <div v-if="filteredIcons.length" class="picker-grid">
            <button
              v-for="icon in filteredIcons"
              :key="icon"
              class="icon-btn"
              :class="{ selected: icon === modelValue }"
              :title="icon.replace('mdi:', '')"
              @click="selectIcon(icon)"
            >
              <Icon :icon="icon" />
            </button>
          </div>
          <div v-else class="picker-empty">
            <Icon icon="mdi:emoticon-sad-outline" class="empty-icon" />
            <span>Иконки не найдены</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.icon-picker-wrapper {
  position: relative;
  display: inline-block;
}

.picker-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  cursor: pointer;
  color: var(--fg-primary-color);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:hover:not(.disabled),
  &.active {
    border-color: var(--border-primary-color);
    background-color: var(--bg-tertiary-color);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.size-sm {
    height: 34px;
    padding: 0 8px;
  }
  &.size-md {
    height: 40px;
    padding: 0 10px;
  }
  &.size-lg {
    height: 48px;
    padding: 0 14px;
  }

  .trigger-icon {
    font-size: 1.3rem;
    flex-shrink: 0;
    &.placeholder {
      color: var(--fg-tertiary-color);
    }

    .size-sm & {
      font-size: 1.1rem;
    }
    .size-lg & {
      font-size: 1.5rem;
    }
  }

  .trigger-chevron {
    font-size: 1rem;
    color: var(--fg-tertiary-color);
    transition: transform 0.2s ease;
    flex-shrink: 0;
    &.rotated {
      transform: rotate(180deg);
    }
  }
}

.icon-picker-panel {
  position: absolute;
  top: calc(100% + 6px);
  z-index: 100;
  width: 320px;
  max-width: min(320px, calc(100vw - 16px));
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  box-shadow: var(--s-l);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &.align-start {
    left: 0;
  }
  &.align-center {
    left: 50%;
    transform: translateX(-50%);
  }
  &.align-end {
    right: 0;
  }

  &.is-inline {
    position: static;
    width: 100%;
    max-width: 100%;
    transform: none;
    box-shadow: none;
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    background-color: var(--bg-secondary-color);
  }
}

.picker-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-secondary-color);

  .search-icon {
    font-size: 1.1rem;
    color: var(--fg-tertiary-color);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    outline: none;
    font-size: 0.875rem;
    color: var(--fg-primary-color);
    font-family: inherit;

    &::placeholder {
      color: var(--fg-tertiary-color);
    }
  }

  .search-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--fg-tertiary-color);
    border-radius: var(--r-s);
    transition:
      color 0.15s,
      background-color 0.15s;
    padding: 0;
    flex-shrink: 0;

    &:hover {
      color: var(--fg-primary-color);
      background-color: var(--bg-hover-color);
    }
  }
}

.picker-categories {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-secondary-color);
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  transition: all 0.15s ease;

  .cat-icon {
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.active {
    background-color: var(--bg-accent-overlay-color);
    border-color: color-mix(in srgb, var(--fg-accent-color) 30%, transparent);
    color: var(--fg-accent-color);
  }
}

.picker-grid-wrap {
  flex: 1;
  overflow-y: auto;
  max-height: 260px;
  padding: 10px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-secondary-color) transparent;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 4px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid transparent;
  border-radius: var(--r-s);
  background: none;
  cursor: pointer;
  font-size: 1.25rem;
  color: var(--fg-secondary-color);
  transition: all 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
    transform: scale(1.1);
  }

  &.selected {
    color: var(--fg-accent-color);
    border-color: color-mix(in srgb, var(--fg-accent-color) 50%, transparent);
    background-color: var(--bg-accent-overlay-color);
  }
}

.picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--fg-tertiary-color);
  font-size: 0.875rem;

  .empty-icon {
    font-size: 2rem;
  }
}

.picker-fade-enter-active,
.picker-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}

.picker-fade-enter-to,
.picker-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.align-center {
  &.picker-fade-enter-from,
  &.picker-fade-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(-6px) scale(0.97);
  }
  &.picker-fade-enter-to,
  &.picker-fade-leave-from {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}
</style>
