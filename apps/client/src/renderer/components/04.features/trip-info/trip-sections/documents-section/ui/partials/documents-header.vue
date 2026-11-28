<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { formatBytes } from '../../constants'

interface Breadcrumb {
  id: string | null
  name: string
}

interface TotalStats {
  count: number
  sizeBytes: number
  favoritesCount: number
}

interface Props {
  breadcrumbs: Breadcrumb[]
  totalStats: TotalStats
  isSelectionMode: boolean
  hasDocuments: boolean
  canAddFolder: boolean
  readonly: boolean
  isUploading: boolean
  uploadProgress: { current: number, total: number }
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'selectCrumb', id: string | null): void
  (e: 'toggleSelectionMode'): void
  (e: 'addFolder'): void
  (e: 'openUpload'): void
}>()
</script>

<template>
  <header class="section-header">
    <div class="header-left">
      <nav class="breadcrumbs" aria-label="Путь к папке">
        <div v-if="breadcrumbs.length > 1" class="crumb-ancestors">
          <template v-for="crumb in breadcrumbs.slice(0, -1)" :key="crumb.id ?? 'root'">
            <KitBtn
              variant="text"
              color="secondary"
              size="sm"
              :icon="crumb.id === null ? 'mdi:folder-home-outline' : undefined"
              :aria-label="crumb.name"
              :title="crumb.name"
              @click="emit('selectCrumb', crumb.id)"
            >
              <span v-if="crumb.id !== null" class="ancestor-name">{{ crumb.name }}</span>
            </KitBtn>
            <Icon icon="mdi:chevron-right" class="crumb-separator" />
          </template>
        </div>
        <span class="crumb-current" aria-current="location" :title="breadcrumbs.at(-1)?.name">
          {{ breadcrumbs.at(-1)?.name }}
        </span>
      </nav>
      <slot name="navigation" />
    </div>

    <div v-if="hasDocuments || !readonly" class="header-meta">
      <div v-if="hasDocuments" class="docs-summary">
        {{ totalStats.count }} файлов <span aria-hidden="true">·</span> {{ formatBytes(totalStats.sizeBytes) }}
      </div>

      <div v-if="!readonly" class="header-right">
        <!-- Кнопка режима мультивыбора -->
        <button
          v-if="hasDocuments"
          type="button"
          class="mode-btn"
          :aria-pressed="isSelectionMode"
          :class="{ 'is-active': isSelectionMode }"
          aria-label="Выбрать несколько файлов"
          title="Выбрать несколько файлов"
          @click="emit('toggleSelectionMode')"
        >
          <Icon icon="mdi:checkbox-multiple-marked-outline" width="18" height="18" />
        </button>

        <KitBtn
          v-if="canAddFolder"
          variant="outlined"
          icon="mdi:folder-plus-outline"
          aria-label="Создать папку"
          size="sm"
          @click="emit('addFolder')"
        >
          <span class="btn-text">Папка</span>
        </KitBtn>

        <!-- Кнопка Загрузить файлы -->
        <KitBtn
          icon="mdi:cloud-upload-outline"
          aria-label="Загрузить файлы"
          size="sm"
          :loading="isUploading"
          @click="emit('openUpload')"
        >
          <span class="btn-text">Загрузить</span>
        </KitBtn>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.section-header,
.header-left,
.header-meta,
.header-right,
.breadcrumbs,
.crumb-ancestors {
  display: flex;
  align-items: center;
  min-width: 0;
}
.section-header {
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 16px;
}
.header-left {
  flex: 1 1 220px;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
}
.header-left > :slotted(.kit-btn) {
  flex-shrink: 0;
}
.breadcrumbs {
  gap: 4px;
}
.crumb-ancestors {
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.crumb-ancestors > * {
  flex-shrink: 0;
}
.ancestor-name,
.crumb-current {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ancestor-name {
  max-width: 110px;
}
.crumb-separator {
  color: var(--fg-secondary-color);
  font-size: 1rem;
}
.crumb-current {
  font-size: 0.9rem;
  font-weight: 600;
}
.crumb-ancestors + .crumb-current {
  flex-shrink: 0;
  max-width: 65%;
}
.header-meta {
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.docs-summary {
  display: flex;
  gap: 5px;
  align-items: baseline;
  font-size: 0.78rem;
  color: var(--fg-secondary-color);
}
.header-right {
  margin-inline-start: auto;
  gap: 6px;
}
.mode-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--r-2xs);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;

  &:hover,
  &[aria-pressed='true'] {
    color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}
@media (max-width: 599px) {
  .header-meta {
    flex-basis: 100%;
  }
  .mode-btn,
  .header-right .kit-btn {
    min-width: 44px;
    min-height: 44px;
  }
}
@media (max-width: 480px) {
  .btn-text {
    display: none;
  }
}
</style>
