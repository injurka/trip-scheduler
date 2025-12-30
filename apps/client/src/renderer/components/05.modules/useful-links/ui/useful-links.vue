<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useUsefulLinks } from '~/components/05.modules/useful-links/composables/use-useful-links'

import { useDisplay } from '~/shared/composables/use-display'

const {
  searchQuery,
  sortOrder,
  selectedTags,
  allTags,
  filteredCategories,
  toggleTag,
  allCategories,
} = useUsefulLinks()

const { mdAndUp } = useDisplay()

const viewMode = ref<'grid' | 'list'>('grid')

const TAGS_LIMIT = 15
const isAllTagsVisible = ref(false)

const visibleTags = computed(() => {
  if (isAllTagsVisible.value)
    return allTags.value
  return allTags.value.slice(0, TAGS_LIMIT)
})

const hasHiddenTags = computed(() => allTags.value.length > TAGS_LIMIT)

const sortOptions = [
  { value: 'default', label: 'По умолчанию', icon: 'mdi:sort' },
  { value: 'alphabetical', label: 'По алфавиту', icon: 'mdi:sort-alphabetical' },
]

const viewModeItems = [
  { id: 'grid', label: 'Сетка', icon: 'mdi:view-grid-outline' },
  { id: 'list', label: 'Список', icon: 'mdi:view-list-outline' },
]

const currentSortOption = computed(() => {
  return sortOptions.find(opt => opt.value === sortOrder.value) || sortOptions[0]
})

function getFaviconUrl(url: string) {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  }
  catch {
    return ''
  }
}

function categoryToId(title: string) {
  return `category-${title.replace(/\s+/g, '-')}`
}

function scrollToCategory(id: string) {
  const element = document.getElementById(id)
  if (element) {
    const y = element.getBoundingClientRect().top + window.scrollY - 100
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
}
</script>

<template>
  <section class="useful-links">
    <div class="page-header">
      <h1>Полезные ссылки</h1>
      <p>Подборка проверенных сервисов, которые помогут спланировать ваше идеальное путешествие.</p>
    </div>

    <div class="quick-filters-wrapper">
      <button
        v-for="category in allCategories"
        :key="category.title"
        class="quick-filter-btn"
        :title="category.title"
        @click="scrollToCategory(categoryToId(category.title))"
      >
        <div class="icon-box">
          <Icon :icon="category.icon" />
        </div>
        <span class="quick-filter-label">{{ category.title }}</span>
      </button>
    </div>

    <div class="tools-panel">
      <div class="tools-main-row">
        <div class="search-wrapper">
          <KitInput
            v-model="searchQuery"
            placeholder="Поиск сервиса..."
            icon="mdi:magnify"
            class="search-input"
          />
        </div>

        <div class="view-controls">
          <KitDropdown
            v-model="sortOrder"
            :items="sortOptions"
            align="end"
            size="md"
          >
            <template #trigger>
              <KitBtn
                :icon="currentSortOption.icon"
                variant="outlined"
                color="secondary"
                class="sort-btn"
              >
                <span v-if="mdAndUp">{{ currentSortOption.label }}</span>
              </KitBtn>
            </template>
          </KitDropdown>
          <KitViewSwitcher v-if="mdAndUp" v-model="viewMode" :items="viewModeItems" />
        </div>
      </div>

      <KitDivider
        v-if="allTags.length" class="tools-divider"
      >
        <span>Теги</span>
      </KitDivider>

      <div v-if="allTags.length" class="tags-row">
        <div class="tags-list">
          <button
            v-for="tag in visibleTags"
            :key="tag"
            class="tag-btn" :class="[{ active: selectedTags.includes(tag) }]"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>

          <button
            v-if="hasHiddenTags"
            class="tag-btn toggle-tags-btn"
            @click="isAllTagsVisible = !isAllTagsVisible"
          >
            <span class="btn-text">{{ isAllTagsVisible ? 'Свернуть' : `Еще ${allTags.length - TAGS_LIMIT}` }}</span>
            <Icon :icon="isAllTagsVisible ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="filteredCategories.length > 0" class="categories-container" :class="[`view--${viewMode}`]">
      <div v-for="category in filteredCategories" :id="categoryToId(category.title)" :key="category.title" class="category-group">
        <h2 class="category-header">
          <div class="category-icon-wrapper">
            <Icon :icon="category.icon" />
          </div>
          <span>{{ category.title }}</span>
          <span class="category-count">{{ category.links.length }}</span>
        </h2>
        <ul class="links-grid">
          <li v-for="link in category.links" :key="link.name" class="link-card-wrapper">
            <a :href="link.url" target="_blank" rel="noopener noreferrer" class="link-card">
              <div class="link-header">
                <div class="favicon-wrapper">
                  <img :src="getFaviconUrl(link.url)" alt="">
                </div>
                <div class="link-meta">
                  <span class="link-name">{{ link.name }}</span>
                  <Icon icon="mdi:open-in-new" class="external-icon" />
                </div>
              </div>

              <p class="link-description">{{ link.description }}</p>

              <div class="link-footer">
                <div v-if="link.recommended" class="badge recommended">
                  <Icon icon="mdi:star" /> Наш выбор
                </div>
                <div v-if="link.tags && link.tags.length" class="mini-tags">
                  <span v-for="tag in link.tags.slice(0, 2)" :key="tag">{{ tag }}</span>
                  <span v-if="link.tags.length > 2" class="more-tag">+{{ link.tags.length - 2 }}</span>
                </div>
              </div>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div v-else class="no-results">
      <Icon icon="mdi:magnify-remove-outline" class="no-results-icon" />
      <h3>Ничего не найдено</h3>
      <p>Попробуйте изменить поисковый запрос или сбросить фильтры по тегам.</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.useful-links {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding-bottom: 4rem;
}

.quick-filters-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.quick-filter-btn {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  border-radius: var(--r-full);
  padding: 0.5rem 1rem 0.5rem 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .icon-box {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: var(--bg-tertiary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    color: var(--fg-accent-color);
    transition: background-color 0.2s;
  }

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);

    .icon-box {
      background-color: var(--bg-secondary-color);
    }
  }
}

.tools-panel {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: var(--s-xs);
}

.tools-main-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-wrapper {
  flex: 1;
  min-width: 280px;

  :deep(.kit-input-group) {
    width: 100%;
  }

  :deep(input) {
    background-color: var(--bg-primary-color);
    border-color: var(--border-secondary-color);

    &:focus {
      border-color: var(--border-accent-color);
    }
  }
}

.view-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;

  .kit-btn {
    height: 46px;
  }

  @include media-down(sm) {
    width: 100%;
    .kit-dropdown {
      flex: 1;
    }
    .sort-btn {
      width: 100%;
      justify-content: center;
    }
  }
}

.tools-divider {
  display: flex;
  gap: 8px;
}

.tags-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;

  @include media-down(sm) {
    flex-direction: column;
    gap: 0.5rem;
  }
}

.tags-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fg-tertiary-color);
  font-size: 0.9rem;
  font-weight: 500;
  padding-top: 6px;
  flex-shrink: 0;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-btn {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  border-radius: var(--r-s);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }

  &.active {
    background-color: var(--fg-accent-color);
    color: var(--fg-inverted-color);
    border-color: var(--fg-accent-color);
  }

  &.toggle-tags-btn {
    border-style: dashed;
    color: var(--fg-tertiary-color);
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
      color: var(--fg-primary-color);
      border-style: solid;
    }
  }
}

.categories-container {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.category-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  margin: 0;
  padding-left: 4px;

  .category-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--fg-accent-color);
    font-size: 1.1rem;
  }

  .category-count {
    font-size: 0.9rem;
    color: var(--fg-tertiary-color);
    font-weight: 500;
    margin-left: auto;
  }
}

.links-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;

  .view--grid & {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  .view--list & {
    grid-template-columns: 1fr;
  }
}

.link-card {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 1rem;
  height: 100%;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
    transform: translateY(-2px);
    box-shadow: var(--s-m);

    .link-name {
      color: var(--fg-accent-color);
    }
    .external-icon {
      color: var(--fg-accent-color);
      opacity: 1;
    }
  }
}

.link-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.favicon-wrapper {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background-color: white;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.link-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}

.link-name {
  font-weight: 600;
  color: var(--fg-primary-color);
  font-size: 1rem;
  transition: color 0.2s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.external-icon {
  font-size: 1rem;
  color: var(--fg-tertiary-color);
  opacity: 0.5;
  transition: all 0.2s;
}

.link-description {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
  margin: 0 0 1rem;
  flex-grow: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.link-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;

  &.recommended {
    background-color: rgba(255, 193, 7, 0.1);
    color: #d97706;
    border: 1px solid rgba(255, 193, 7, 0.2);
  }
}

.mini-tags {
  display: flex;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);

  .more-tag {
    font-weight: 500;
  }
}

.no-results {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--fg-secondary-color);
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-l);
  margin-top: 1rem;

  .no-results-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    color: var(--fg-tertiary-color);
  }

  h3 {
    font-size: 1.5rem;
    color: var(--fg-primary-color);
    margin: 0 0 0.5rem;
  }
  p {
    margin: 0;
  }
}
</style>
