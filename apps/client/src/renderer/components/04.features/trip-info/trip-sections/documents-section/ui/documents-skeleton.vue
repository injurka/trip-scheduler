<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'

interface Props {
  viewMode?: 'grid' | 'list'
  showFolders?: boolean
  showToolbar?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  viewMode: undefined,
  showFolders: true,
  showToolbar: true,
  readonly: false,
})

const storedViewMode = useStorage<'grid' | 'list'>('documents_view_mode', 'grid')
const activeViewMode = computed(() => props.viewMode || storedViewMode.value || 'grid')
</script>

<template>
  <div class="documents-skeleton">
    <!-- ВЕРХНЯЯ ПАНЕЛЬ ХЕДЕРА -->
    <header class="skeleton-header">
      <div class="header-left">
        <div class="breadcrumb-item">
          <KitSkeleton width="130px" height="30px" border-radius="var(--r-m)" />
        </div>
        <KitSkeleton width="96px" height="24px" border-radius="20px" />
      </div>

      <div v-if="!readonly" class="header-right">
        <KitSkeleton width="34px" height="32px" border-radius="var(--r-s)" />
        <KitSkeleton width="86px" height="32px" border-radius="var(--r-s)" />
        <KitSkeleton width="118px" height="32px" border-radius="var(--r-s)" />
      </div>
    </header>

    <!-- ТУЛБАР ФИЛЬТРОВ И ПОИСКА -->
    <div v-if="showToolbar" class="skeleton-filters-toolbar">
      <div class="search-box">
        <KitSkeleton width="100%" height="36px" border-radius="var(--r-s)" />
      </div>

      <div class="categories-filter">
        <KitSkeleton width="54px" height="30px" border-radius="20px" />
        <KitSkeleton width="80px" height="30px" border-radius="20px" />
        <KitSkeleton width="76px" height="30px" border-radius="20px" />
        <KitSkeleton width="94px" height="30px" border-radius="20px" />
        <KitSkeleton width="68px" height="30px" border-radius="20px" />
      </div>

      <div class="fav-toggle-box">
        <KitSkeleton width="38px" height="38px" border-radius="var(--r-s)" />
      </div>
    </div>

    <!-- БЛОК ПАПОК -->
    <div v-if="showFolders" class="skeleton-folders-block">
      <div class="section-subtitle">
        <KitSkeleton width="16px" height="16px" border-radius="4px" />
        <KitSkeleton width="90px" height="16px" border-radius="4px" />
      </div>

      <div class="folders-grid">
        <div v-for="i in 3" :key="i" class="skeleton-folder-card">
          <div class="folder-icon-wrapper">
            <KitSkeleton width="38px" height="38px" border-radius="var(--r-s)" />
          </div>
          <div class="folder-details">
            <KitSkeleton width="65%" height="16px" border-radius="4px" />
            <KitSkeleton width="45%" height="12px" border-radius="4px" />
          </div>
          <div v-if="!readonly" class="folder-actions">
            <KitSkeleton width="26px" height="26px" border-radius="var(--r-xs)" />
          </div>
        </div>
      </div>
    </div>

    <!-- БЛОК ДОКУМЕНТОВ -->
    <div class="skeleton-docs-block">
      <!-- Хедер списка документов -->
      <div class="docs-header-bar">
        <div class="section-subtitle">
          <KitSkeleton width="16px" height="16px" border-radius="4px" />
          <KitSkeleton width="130px" height="16px" border-radius="4px" />
        </div>

        <div class="docs-view-controls">
          <KitSkeleton width="130px" height="36px" border-radius="var(--r-s)" />
          <KitSkeleton width="68px" height="34px" border-radius="var(--r-s)" />
        </div>
      </div>

      <!-- Сетка документов (Grid) -->
      <div v-if="activeViewMode === 'grid'" class="documents-grid">
        <div v-for="i in 8" :key="i" class="skeleton-doc-card">
          <div class="card-preview-area">
            <KitSkeleton width="100%" height="125px" border-radius="0" />
          </div>
          <div class="card-body">
            <div class="card-tags-row">
              <KitSkeleton width="64px" height="18px" border-radius="var(--r-xs)" />
              <KitSkeleton width="22px" height="18px" border-radius="var(--r-xs)" />
            </div>
            <div class="card-title-box">
              <KitSkeleton width="80%" height="16px" border-radius="4px" />
            </div>
            <div class="card-footer">
              <div class="card-meta">
                <KitSkeleton width="50px" height="12px" border-radius="4px" />
                <span class="dot">•</span>
                <KitSkeleton width="60px" height="12px" border-radius="4px" />
              </div>
              <div class="card-actions">
                <KitSkeleton width="28px" height="28px" border-radius="var(--r-xs)" />
                <KitSkeleton v-if="!readonly" width="28px" height="28px" border-radius="var(--r-xs)" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Список документов (List) -->
      <div v-else class="documents-list">
        <div v-for="i in 6" :key="i" class="skeleton-doc-row">
          <div v-if="!readonly" class="row-checkbox-box">
            <KitSkeleton width="18px" height="18px" border-radius="var(--r-xs)" />
          </div>
          <div class="row-icon-box">
            <KitSkeleton width="36px" height="36px" border-radius="var(--r-xs)" />
          </div>
          <div class="row-title-area">
            <KitSkeleton width="60%" height="16px" border-radius="4px" />
          </div>
          <div class="row-category-area">
            <KitSkeleton width="72px" height="20px" border-radius="var(--r-xs)" />
          </div>
          <div class="row-meta-area">
            <KitSkeleton width="48px" height="11px" border-radius="4px" />
            <KitSkeleton width="68px" height="11px" border-radius="4px" />
          </div>
          <div class="row-access-area">
            <KitSkeleton width="24px" height="22px" border-radius="var(--r-xs)" />
          </div>
          <div v-if="!readonly" class="row-star-area">
            <KitSkeleton width="26px" height="26px" border-radius="var(--r-xs)" />
          </div>
          <div class="row-actions-area">
            <KitSkeleton width="28px" height="28px" border-radius="var(--r-xs)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.documents-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

/* ==================== HEADER ==================== */
.skeleton-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 40px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

/* ==================== FILTERS TOOLBAR ==================== */
.skeleton-filters-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;

  .search-box {
    flex: 0 1 300px;
    min-width: 180px;
  }

  .categories-filter {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  .fav-toggle-box {
    flex-shrink: 0;
  }
}

/* ==================== SUBTITLE ==================== */
.section-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

/* ==================== FOLDERS ==================== */
.skeleton-folders-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;

  .folders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }

  .skeleton-folder-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: var(--r-m);
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);

    .folder-icon-wrapper {
      width: 38px;
      height: 38px;
      flex-shrink: 0;
    }

    .folder-details {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      gap: 4px;
    }

    .folder-actions {
      margin-left: auto;
      flex-shrink: 0;
    }
  }
}

/* ==================== DOCUMENTS ==================== */
.skeleton-docs-block {
  display: flex;
  flex-direction: column;

  .docs-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    min-height: 36px;

    .section-subtitle {
      margin-bottom: 0;
    }
  }

  .docs-view-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
  gap: 14px;
  min-width: 0;
  width: 100%;

  .skeleton-doc-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;

    .card-preview-area {
      width: 100%;
      height: 125px;
      background-color: var(--bg-tertiary-color);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-body {
      display: flex;
      flex-direction: column;
      padding: 12px;
      gap: 8px;
      flex-grow: 1;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .card-tags-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-height: 22px;
      min-width: 0;
      width: 100%;
    }

    .card-title-box {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      width: 100%;
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: auto;
      padding-top: 6px;
      border-top: 1px solid var(--border-secondary-color);

      .card-meta {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.78rem;
        color: var(--fg-tertiary-color);

        .dot {
          opacity: 0.5;
        }
      }

      .card-actions {
        display: flex;
        align-items: center;
        gap: 2px;
      }
    }
  }
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .skeleton-doc-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: var(--r-s);
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);

    .row-checkbox-box {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .row-icon-box {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }

    .row-title-area {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1 1 0;
      gap: 2px;
    }

    .row-category-area {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .row-meta-area {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
    }

    .row-access-area {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .row-star-area {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .row-actions-area {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
  }
}

@media (max-width: 768px) {
  .skeleton-filters-toolbar {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'search fav'
      'categories categories';
    gap: 8px 10px;
    padding: 10px 12px;

    .search-box {
      grid-area: search;
      max-width: none;
    }

    .fav-toggle-box {
      grid-area: fav;
    }

    .categories-filter {
      grid-area: categories;
      overflow-x: hidden;
    }
  }

  .skeleton-doc-row {
    .row-category-area,
    .row-access-area {
      display: none !important;
    }
  }
}
</style>
