<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'

interface Props {
  viewMode?: 'grid' | 'list'
  showFolders?: boolean
  showToolbar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  viewMode: undefined,
  showFolders: true,
  showToolbar: true,
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
          <KitSkeleton width="130px" height="30px" border-radius="var(--r-s)" />
        </div>
        <KitSkeleton width="96px" height="24px" border-radius="20px" />
      </div>

      <div class="header-right">
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
        <KitSkeleton width="54px" height="32px" border-radius="20px" />
        <KitSkeleton width="80px" height="32px" border-radius="20px" />
        <KitSkeleton width="76px" height="32px" border-radius="20px" />
        <KitSkeleton width="94px" height="32px" border-radius="20px" />
        <KitSkeleton width="68px" height="32px" border-radius="20px" />
      </div>

      <div class="fav-toggle-box">
        <KitSkeleton width="36px" height="36px" border-radius="var(--r-s)" />
      </div>
    </div>

    <!-- БЛОК ПАПОК -->
    <div v-if="showFolders" class="skeleton-folders-block">
      <div class="section-subtitle">
        <KitSkeleton width="100px" height="18px" border-radius="4px" />
      </div>

      <div class="folders-grid">
        <div v-for="i in 3" :key="i" class="skeleton-folder-card">
          <KitSkeleton width="38px" height="38px" border-radius="var(--r-s)" />
          <div class="folder-details">
            <KitSkeleton width="65%" height="16px" border-radius="4px" />
            <KitSkeleton width="45%" height="12px" border-radius="4px" />
          </div>
        </div>
      </div>
    </div>

    <!-- БЛОК ДОКУМЕНТОВ -->
    <div class="skeleton-docs-block">
      <!-- Хедер списка документов -->
      <div class="docs-header-bar">
        <div class="section-subtitle">
          <KitSkeleton width="140px" height="18px" border-radius="4px" />
        </div>

        <div class="docs-view-controls">
          <KitSkeleton width="130px" height="36px" border-radius="var(--r-s)" />
          <KitSkeleton width="68px" height="36px" border-radius="var(--r-s)" />
        </div>
      </div>

      <!-- Сетка документов (Grid) -->
      <div v-if="activeViewMode === 'grid'" class="documents-grid">
        <div v-for="i in 8" :key="i" class="skeleton-doc-card">
          <div class="thumbnail-area">
            <KitSkeleton width="100%" height="110px" border-radius="var(--r-s)" />
          </div>
          <div class="card-details">
            <KitSkeleton width="75%" height="15px" border-radius="4px" />
            <div class="meta-row">
              <KitSkeleton width="50px" height="16px" border-radius="4px" />
              <KitSkeleton width="55px" height="12px" border-radius="4px" />
              <KitSkeleton width="65px" height="12px" border-radius="4px" />
            </div>
          </div>
        </div>
      </div>

      <!-- Список документов (List) -->
      <div v-else class="documents-list">
        <div v-for="i in 6" :key="i" class="skeleton-doc-row">
          <KitSkeleton width="36px" height="36px" border-radius="var(--r-s)" />
          <div class="row-info">
            <KitSkeleton width="220px" height="16px" border-radius="4px" />
            <KitSkeleton width="60px" height="16px" border-radius="4px" />
          </div>
          <div class="row-meta">
            <KitSkeleton width="60px" height="14px" border-radius="4px" />
            <KitSkeleton width="75px" height="14px" border-radius="4px" />
          </div>
          <div class="row-actions">
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
    flex: 1;
    min-width: 200px;
    max-width: 320px;
  }

  .categories-filter {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 2;
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
  margin-bottom: 12px;

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

    .folder-details {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      gap: 6px;
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
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;

  .skeleton-doc-card {
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .card-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 6px;
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
    padding: 10px 14px;
    border-radius: var(--r-m);
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);

    .row-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .row-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .row-actions {
      margin-left: auto;
      flex-shrink: 0;
    }
  }
}

@media (max-width: 600px) {
  .skeleton-filters-toolbar {
    flex-direction: column;
    align-items: stretch;

    .search-box {
      max-width: none;
    }
  }

  .skeleton-doc-row {
    .row-meta {
      display: none !important;
    }
  }
}
</style>
