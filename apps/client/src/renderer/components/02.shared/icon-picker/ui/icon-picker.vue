<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { iconCategories } from '~/shared/constants/icon-list'
import { useIconPicker } from '../composables/use-icon-picker'

interface Props {
  modelValue?: string
  mode?: 'dropdown' | 'modal'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  inline?: boolean
  chevron?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  mode: 'dropdown',
  size: 'md',
  disabled: false,
  align: 'center',
  inline: false,
  chevron: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', icon: string): void
}>()

const searchInputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)

const { searchQuery, activeCategoryId, filteredIcons, reset } = useIconPicker()

const ALL_ID = 'all'

const allCategoryTab = { id: ALL_ID, label: 'Все', icon: 'mdi:dots-grid' }
const categoryTabs = computed(() => [allCategoryTab, ...iconCategories])

// Синхронизация: фокусируем поиск при открытии, сбрасываем при закрытии
watch(isOpen, (val) => {
  if (val) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
  else {
    // Небольшая задержка, чтобы контент не менялся во время анимации закрытия
    setTimeout(() => {
      reset()
    }, 200)
  }
})

function open() {
  if (props.disabled)
    return
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function selectIcon(icon: string) {
  emit('update:modelValue', icon)
  if (!props.inline)
    close()
}

function setCategory(id: string) {
  activeCategoryId.value = id
  searchQuery.value = ''
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function clearSearch() {
  searchQuery.value = ''
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}
</script>

<template>
  <!-- INLINE MODE -->
  <div v-if="inline" class="icon-picker-body is-inline">
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

  <div v-else class="icon-picker-wrapper" :class="`size-${size}`">
    <!-- DROPDOWN MODE -->
    <KitDropdown
      v-if="mode === 'dropdown'"
      v-model:open="isOpen"
      :align="align"
    >
      <template #trigger>
        <button
          class="picker-trigger"
          :class="[`size-${size}`, { disabled, active: isOpen }]"
          :disabled="disabled"
        >
          <Icon
            :icon="modelValue || 'mdi:image-off-outline'"
            class="trigger-icon"
            :class="{ placeholder: !modelValue }"
          />
          <Icon
            v-if="chevron"
            icon="mdi:chevron-down"
            class="trigger-chevron"
            :class="{ rotated: isOpen }"
          />
        </button>
      </template>

      <!-- Dropdown Content -->
      <div class="icon-picker-body is-dropdown">
        <div class="picker-search">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            class="search-input"
            placeholder="Поиск иконок..."
            type="text"
            @keydown.stop
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
    </KitDropdown>

    <!-- MODAL MODE -->
    <template v-else-if="mode === 'modal'">
      <button
        class="picker-trigger"
        :class="[`size-${size}`, { disabled, active: isOpen }]"
        :disabled="disabled"
        @click="open"
      >
        <Icon
          :icon="modelValue || 'mdi:image-off-outline'"
          class="trigger-icon"
          :class="{ placeholder: !modelValue }"
        />
        <!-- Без chevron согласно ТЗ -->
      </button>

      <KitDialogWithClose
        v-model:visible="isOpen"
        title="Выберите иконку"
        icon="mdi:image-outline"
        :max-width="400"
      >
        <div class="icon-picker-body is-modal">
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
      </KitDialogWithClose>
    </template>
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
    height: 46px;
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

.icon-picker-body {
  display: flex;
  flex-direction: column;

  &.is-dropdown {
    width: 320px;
    /* Компенсация базовых отступов от kit-dropdown, чтобы строка поиска прилипала к краям */
    margin: -6px;
    background-color: var(--bg-secondary-color);
    border-radius: calc(var(--r-s) - 1px);
    overflow: hidden;
  }

  &.is-inline {
    width: 100%;
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    background-color: var(--bg-secondary-color);
  }

  &.is-modal {
    width: 100%;

    .picker-search {
      /* В модалке лучше убрать нижнюю рамку и сделать заливку для поиска */
      border-bottom: none;
      background-color: var(--bg-tertiary-color);
      border-radius: var(--r-m);
      margin-bottom: 8px;
    }

    .picker-grid-wrap {
      max-height: 50vh; /* Позволяем сетке расти внутри модалки */
      padding: 0 4px;
    }
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
  display: none;

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
</style>
