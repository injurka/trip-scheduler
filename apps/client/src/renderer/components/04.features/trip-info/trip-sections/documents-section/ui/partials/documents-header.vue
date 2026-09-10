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
      <!-- Кнопка назад к корню, если мы внутри папки -->
      <button
        v-if="breadcrumbs.length > 1"
        class="back-btn"
        title="Назад ко всем документам"
        @click="emit('selectCrumb', null)"
      >
        <Icon icon="mdi:arrow-left" width="18" height="18" />
      </button>

      <div class="breadcrumbs">
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id || 'root'">
          <button
            class="crumb"
            :class="{ 'is-active': index === breadcrumbs.length - 1 }"
            @click="emit('selectCrumb', crumb.id)"
          >
            <Icon v-if="index === 0" icon="mdi:folder-home-outline" class="crumb-icon" />
            <Icon v-else icon="mdi:folder" class="crumb-icon" />
            <span class="crumb-text">{{ crumb.name }}</span>
          </button>
          <Icon v-if="index < breadcrumbs.length - 1" icon="mdi:chevron-right" class="crumb-separator" />
        </template>
      </div>

      <!-- Краткая сводка -->
      <div v-if="hasDocuments" class="docs-summary-badge">
        <span>{{ totalStats.count }} файлов</span>
        <span class="dot">•</span>
        <span>{{ formatBytes(totalStats.sizeBytes) }}</span>
      </div>
    </div>

    <div class="header-right">
      <!-- Кнопка режима мультивыбора -->
      <button
        v-if="!readonly && hasDocuments"
        class="mode-btn"
        :class="{ 'is-active': isSelectionMode }"
        :title="isSelectionMode ? 'Выйти из режима выбора' : 'Выбрать несколько файлов'"
        @click="emit('toggleSelectionMode')"
      >
        <Icon icon="mdi:checkbox-multiple-marked-outline" width="18" height="18" />
      </button>

      <!-- Кнопка Новая папка (только в корне) -->
      <KitBtn
        v-if="!readonly && canAddFolder"
        variant="outlined"
        icon="mdi:folder-plus-outline"
        size="sm"
        @click="emit('addFolder')"
      >
        <span class="btn-text">Папка</span>
      </KitBtn>

      <!-- Кнопка Загрузить файлы -->
      <KitBtn
        v-if="!readonly"
        icon="mdi:cloud-upload-outline"
        size="sm"
        :loading="isUploading"
        @click="emit('openUpload')"
      >
        <span class="btn-text">Загрузить</span>
      </KitBtn>
    </div>
  </header>
</template>

<style scoped lang="scss">
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 40px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);
  }
}

.breadcrumbs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 3px 6px;

  .crumb {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: var(--r-s);
    border: none;
    background: transparent;
    color: var(--fg-secondary-color);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background-color 0.15s ease;

    &:hover {
      color: var(--fg-primary-color);
      background-color: var(--bg-hover-color);
    }

    &.is-active {
      color: var(--fg-primary-color);
      background-color: var(--bg-primary-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      cursor: default;
    }
  }

  .crumb-icon {
    font-size: 1rem;
    opacity: 0.8;
  }

  .crumb-separator {
    color: var(--fg-tertiary-color);
    font-size: 0.85rem;
  }
}

.docs-summary-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 20px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.78rem;
  color: var(--fg-tertiary-color);
  font-weight: 500;

  .dot {
    opacity: 0.5;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;

  .mode-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 32px;
    border-radius: var(--r-s);
    border: 1px solid var(--border-secondary-color);
    background-color: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      color: var(--fg-primary-color);
      background-color: var(--bg-hover-color);
    }

    &.is-active {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      background-color: rgba(var(--fg-accent-color-rgb), 0.1);
    }
  }

  @media (max-width: 480px) {
    .btn-text {
      display: none;
    }
  }
}
</style>
