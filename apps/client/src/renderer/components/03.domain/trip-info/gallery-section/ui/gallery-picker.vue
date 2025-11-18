<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { TripImage } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { useDebounce, useElementSize, useVirtualList } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInput } from '~/components/01.kit/kit-input'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

interface Props {
  visible: boolean
  initialSelectedUrls: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', urls: string[]): void
}>()

const store = useModuleStore(['routeGallery'])
const { tripImages, isFetchingImages } = storeToRefs(store.routeGallery)

// --- State ---
const selectedUrls = ref<Set<string>>(new Set())

// 1. Create our own ref for the container to measure size
const containerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)

// --- Filters State ---
const searchQuery = ref('')
const debouncedSearch = useDebounce(searchQuery, 300)
const sortOrder = ref<'newest' | 'oldest' | 'size_desc'>('newest')
const showSelectedOnly = ref(false)

const sortOptions: KitDropdownItem[] = [
  { value: 'newest', label: 'Сначала новые', icon: 'mdi:sort-calendar-descending' },
  { value: 'oldest', label: 'Сначала старые', icon: 'mdi:sort-calendar-ascending' },
  { value: 'size_desc', label: 'По размеру', icon: 'mdi:sort-numeric-descending' },
]

// --- Logic ---

// Initialize when opened
watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    selectedUrls.value = new Set(props.initialSelectedUrls)
    searchQuery.value = ''
    showSelectedOnly.value = false
  }
})

// 2. Filter & Sort Images
const processedImages = computed(() => {
  let images = [...tripImages.value]

  if (showSelectedOnly.value) {
    images = images.filter(img => selectedUrls.value.has(img.url))
  }

  if (debouncedSearch.value) {
    const query = debouncedSearch.value.toLowerCase()
    images = images.filter(img =>
      img.originalName.toLowerCase().includes(query),
    )
  }

  images.sort((a, b) => {
    switch (sortOrder.value) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'size_desc':
        return b.sizeBytes - a.sizeBytes
      default:
        return 0
    }
  })

  return images
})

// 3. Grid Calculation
const ITEM_MIN_WIDTH = 160
const GAP = 8
const columnsCount = computed(() => {
  if (containerWidth.value <= 0)
    return 3
  return Math.floor((containerWidth.value + GAP) / (ITEM_MIN_WIDTH + GAP)) || 1
})

// 4. Chunking for Virtual Scroll
const virtualRows = computed(() => {
  const cols = columnsCount.value
  const rows: TripImage[][] = []
  for (let i = 0; i < processedImages.value.length; i += cols) {
    rows.push(processedImages.value.slice(i, i + cols))
  }
  return rows
})

// 5. Virtual List
const { list: visibleRows, containerProps, wrapperProps } = useVirtualList(virtualRows, {
  itemHeight: ITEM_MIN_WIDTH + GAP,
  overscan: 5,
})

// Sync refs: useVirtualList needs to know about the element
watch(containerRef, (el) => {
  if (containerProps.ref) {
    containerProps.ref.value = el
  }
})

// Exclude 'ref' from containerProps to avoid TS conflict in template
const bindableContainerProps = computed(() => {
  const { ref: _, ...rest } = containerProps
  return rest
})

// --- Methods ---

function toggleSelection(url: string) {
  if (selectedUrls.value.has(url))
    selectedUrls.value.delete(url)
  else
    selectedUrls.value.add(url)
}

function handleConfirm() {
  emit('confirm', Array.from(selectedUrls.value))
  emit('update:visible', false)
}

function handleClose() {
  emit('update:visible', false)
}

const currentSortIcon = computed(() =>
  sortOptions.find(o => o.value === sortOrder.value)?.icon || 'mdi:sort',
)
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Галерея путешествия"
    icon="mdi:image-multiple-outline"
    :max-width="900"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="picker-content">
      <!-- Filters Toolbar -->
      <div class="picker-filters">
        <div class="search-wrapper">
          <KitInput
            v-model="searchQuery"
            placeholder="Поиск по названию..."
            icon="mdi:magnify"
            size="sm"
          />
        </div>

        <div class="actions-wrapper">
          <KitBtn
            variant="outlined"
            color="secondary"
            size="sm"
            :icon="showSelectedOnly ? 'mdi:checkbox-marked-circle-outline' : 'mdi:checkbox-blank-circle-outline'"
            :class="{ 'is-active': showSelectedOnly }"
            @click="showSelectedOnly = !showSelectedOnly"
          >
            {{ showSelectedOnly ? 'Выбранные' : 'Все' }}
          </KitBtn>

          <KitDropdown v-model="sortOrder" :items="sortOptions" align="end">
            <template #trigger>
              <KitBtn variant="outlined" color="secondary" size="sm" :icon="currentSortIcon">
                Сортировка
              </KitBtn>
            </template>
          </KitDropdown>
        </div>
      </div>

      <!-- Content Area -->
      <div class="picker-body">
        <!-- Loading State -->
        <div v-if="isFetchingImages" class="state-message">
          <Icon icon="mdi:loading" class="spinner" />
          <p>Загружаем изображения...</p>
        </div>

        <!-- Empty State (Global) -->
        <div v-else-if="tripImages.length === 0" class="state-message">
          <Icon icon="mdi:image-off-outline" />
          <p>В галерее путешествия еще нет изображений.</p>
        </div>

        <!-- Empty State (After Filter) -->
        <div v-else-if="processedImages.length === 0" class="state-message">
          <Icon icon="mdi:filter-remove-outline" />
          <p>Ничего не найдено по вашему запросу.</p>
        </div>

        <!-- Virtual Grid -->
        <div
          v-else
          ref="containerRef"
          v-bind="bindableContainerProps"
          class="image-grid-virtual"
        >
          <div v-bind="wrapperProps" class="image-grid-wrapper">
            <div
              v-for="row in visibleRows"
              :key="row.index"
              class="grid-row"
              :style="{
                gap: `${GAP}px`,
                height: `${ITEM_MIN_WIDTH}px`,
                marginBottom: `${GAP}px`,
              }"
            >
              <div
                v-for="tripImg in row.data"
                :key="tripImg.id"
                class="grid-item"
                :class="{ selected: selectedUrls.has(tripImg.url) }"
                :style="{ flexBasis: `${100 / columnsCount}%` }"
                @click="toggleSelection(tripImg.url)"
              >
                <KitImage :src="tripImg.variants?.small || tripImg.url" object-fit="cover" />

                <!-- Selection Overlay -->
                <div class="overlay">
                  <Icon
                    :icon="selectedUrls.has(tripImg.url) ? 'mdi:check-circle' : 'mdi:circle-outline'"
                    class="check-icon"
                    :class="{ selected: selectedUrls.has(tripImg.url) }"
                  />
                </div>

                <!-- Info Overlay -->
                <div class="info-overlay">
                  <span class="file-name">{{ tripImg.originalName }}</span>
                  <span class="file-size">{{ (tripImg.sizeBytes / 1024 / 1024).toFixed(2) }} MB</span>
                </div>
              </div>
              <!-- Fillers -->
              <div
                v-for="n in (columnsCount - row.data.length)"
                :key="`filler-${n}`"
                class="grid-item-filler"
                :style="{ flexBasis: `${100 / columnsCount}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="!isFetchingImages" class="picker-footer">
        <div class="selection-count">
          Выбрано: {{ selectedUrls.size }}
        </div>
        <div class="footer-actions">
          <KitBtn variant="text" @click="handleClose">
            Отмена
          </KitBtn>
          <KitBtn @click="handleConfirm">
            Сохранить
          </KitBtn>
        </div>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.picker-content {
  display: flex;
  flex-direction: column;
  height: calc(85vh - 100px);
  overflow: hidden;
}

.picker-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 4px 12px 4px;
  border-bottom: 1px solid var(--border-secondary-color);
  margin-bottom: 8px;
  flex-shrink: 0;
  align-items: center;

  .search-wrapper {
    flex-grow: 1;
    min-width: 200px;
  }

  .actions-wrapper {
    display: flex;
    gap: 8px;
  }

  .is-active {
    background-color: var(--bg-accent-color);
    border-color: var(--fg-accent-color);
    color: var(--fg-on-accent-color);
  }
}

.picker-body {
  flex-grow: 1;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--fg-secondary-color);
  text-align: center;
  padding: 20px;

  .spinner {
    font-size: 3rem;
    animation: spin 1.5s linear infinite;
  }

  p {
    margin-top: 16px;
    font-size: 1.1rem;
  }

  & > .iconify {
    font-size: 4rem;
    opacity: 0.5;
    margin-bottom: 1rem;
  }
}

/* Virtual Grid */
.image-grid-virtual {
  height: 100%;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-primary-color);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.image-grid-wrapper {
  display: flex;
  flex-direction: column;
}

.grid-row {
  display: flex;
  width: 100%;
}

.grid-item {
  position: relative;
  cursor: pointer;
  border-radius: var(--r-s);
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.15s ease;
  height: 100%;
  flex-grow: 1;
  background-color: var(--bg-tertiary-color);

  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0%, transparent 50%);
    opacity: 0.8;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .check-icon {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 1.5rem;
    color: var(--fg-inverted-color);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
    z-index: 2;

    &.selected {
      color: var(--fg-accent-color);
    }
  }

  .info-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
    padding: 24px 8px 8px;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
    color: white;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .file-name {
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-size {
      font-size: 0.7rem;
      opacity: 0.8;
    }
  }

  &.selected {
    border-color: var(--fg-accent-color);
    transform: scale(0.96);
    .overlay {
      opacity: 1;
    }
  }

  &:hover {
    .info-overlay {
      opacity: 1;
    }
  }
}

.grid-item-filler {
  flex-grow: 1;
  height: 100%;
}

.picker-footer {
  padding-top: 16px;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border-secondary-color);
}

.selection-count {
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  font-weight: 500;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
