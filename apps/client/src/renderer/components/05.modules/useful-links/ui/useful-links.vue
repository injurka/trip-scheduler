<script setup lang="ts">
import type { CategoryId } from '../models/types'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useDisplay } from '~/shared/composables/use-display'
import { useUsefulLinks } from '../composables/use-useful-links'

const {
  selectedCountryId,
  selectedCategory,
  searchQuery,
  sortOrder,
  allCountries,
  popularCountries,
  currentCountry,
  isGlobalView,
  categories,
  filteredCategories,
  totalResultsCount,
  setCountry,
  setCategory,
  clearFilters,
  isServiceBlocked,
  isServicePopularIn,
  getServiceCountryNote,
} = useUsefulLinks()

const { mdAndUp, smAndDown } = useDisplay()

const viewMode = ref<'grid' | 'list'>('grid')
const isTipsExpanded = ref(true)

const sortOptions = [
  { value: 'default', label: 'По релевантности', icon: 'mdi:sort-variant' },
  { value: 'alphabetical', label: 'По алфавиту', icon: 'mdi:sort-alphabetical-ascending' },
]

const currentSortOption = computed(() => {
  return sortOptions.find(opt => opt.value === sortOrder.value) || sortOptions[0]
})

const countryDropdownItems = computed(() => {
  return allCountries.value.map(country => ({
    value: country.id,
    label: `${country.flag} ${country.name}`,
  }))
})

const viewModeItems = [
  { id: 'grid', label: 'Сетка', icon: 'mdi:view-grid-outline' },
  { id: 'list', label: 'Список', icon: 'mdi:view-list-outline' },
]

function getFaviconUrl(url: string) {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  }
  catch {
    return ''
  }
}

function categoryToId(id: string) {
  return `category-section-${id}`
}

function scrollToCategory(id: string) {
  const element = document.getElementById(categoryToId(id))
  if (element) {
    const y = element.getBoundingClientRect().top + window.scrollY - 110
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
}

function handleCategoryClick(catId: CategoryId | 'all') {
  setCategory(catId)
  if (catId !== 'all') {
    nextTick(() => {
      scrollToCategory(catId)
    })
  }
}
</script>

<template>
  <section class="useful-links">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">
        Полезные ссылки и сервисы
      </h1>
      <p class="page-subtitle">
        Подборка проверенных приложений, локальных сервисов и особенностей работы в разных странах мира.
      </p>
    </div>

    <!-- Country Selector Section -->
    <div class="country-selector-section">
      <div class="section-title-row">
        <span class="section-label">
          <Icon icon="mdi:earth" class="label-icon" />
          Выберите страну или регион:
        </span>

        <div class="country-dropdown-wrapper">
          <KitDropdown
            :model-value="selectedCountryId"
            :items="countryDropdownItems"
            align="end"
            size="sm"
            @update:model-value="(val) => val && setCountry(val as string)"
          >
            <template #trigger>
              <KitBtn variant="outlined" color="secondary" size="sm" class="all-countries-btn">
                <span>{{ currentCountry.flag }} {{ currentCountry.name }}</span>
                <Icon icon="mdi:chevron-down" />
              </KitBtn>
            </template>
          </KitDropdown>
        </div>
      </div>

      <div class="country-chips-bar">
        <button
          v-for="country in popularCountries"
          :key="country.id"
          class="country-chip"
          :class="{ active: selectedCountryId === country.id }"
          @click="setCountry(country.id)"
        >
          <span class="country-flag">{{ country.flag }}</span>
          <span class="country-name">{{ country.name }}</span>
        </button>
      </div>
    </div>

    <!-- Country Travel Tips & Warnings Banner -->
    <Transition name="fade-collapse">
      <div v-if="currentCountry.tips && currentCountry.tips.length" class="country-tips-card">
        <div class="tips-header" @click="isTipsExpanded = !isTipsExpanded">
          <div class="tips-title-group">
            <span class="tips-country-flag">{{ currentCountry.flag }}</span>
            <div>
              <h2 class="tips-country-title">
                Особенности и лайфхаки: {{ currentCountry.name }}
              </h2>
              <p class="tips-country-desc">
                {{ currentCountry.description }}
              </p>
            </div>
          </div>
          <button class="tips-toggle-btn" :aria-label="isTipsExpanded ? 'Свернуть' : 'Развернуть'">
            <Icon :icon="isTipsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
          </button>
        </div>

        <div v-show="isTipsExpanded" class="tips-grid">
          <div
            v-for="(tip, idx) in currentCountry.tips"
            :key="idx"
            class="tip-item"
            :class="[`tip--${tip.type || 'tip'}`]"
          >
            <div class="tip-icon-box">
              <Icon :icon="tip.icon || (tip.type === 'warning' ? 'mdi:alert' : 'mdi:lightbulb-outline')" />
            </div>
            <div class="tip-content">
              <h3 class="tip-title">
                {{ tip.title }}
              </h3>
              <p class="tip-text">
                {{ tip.text }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Category Tabs Navigation -->
    <div class="category-tabs-bar">
      <button
        class="category-tab-btn"
        :class="{ active: selectedCategory === 'all' }"
        @click="handleCategoryClick('all')"
      >
        <Icon icon="mdi:apps" />
        <span>Все категории</span>
        <span class="tab-count">{{ totalResultsCount }}</span>
      </button>

      <button
        v-for="cat in categories"
        :key="cat.id"
        class="category-tab-btn"
        :class="{ active: selectedCategory === cat.id }"
        @click="handleCategoryClick(cat.id)"
      >
        <Icon :icon="cat.icon" />
        <span>{{ cat.title }}</span>
      </button>
    </div>

    <!-- Search & Controls Panel -->
    <div class="tools-panel">
      <div class="tools-main-row">
        <div class="search-wrapper">
          <KitInput
            v-model="searchQuery"
            placeholder="Поиск сервиса, приложения или ключевого слова (например, такси, поезда, карты)..."
            icon="mdi:magnify"
            class="search-input"
          />
        </div>

        <div class="tools-actions">
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
      </div>
    </div>

    <!-- Active Filters Summary (if filters active) -->
    <div v-if="searchQuery || selectedCategory !== 'all'" class="active-filters-bar">
      <span class="filters-summary-text">
        Найдено: <strong>{{ totalResultsCount }}</strong> сервисов
      </span>
      <button class="reset-filters-btn" @click="clearFilters">
        <Icon icon="mdi:close-circle-outline" />
        <span>Сбросить фильтры</span>
      </button>
    </div>

    <!-- Categories & Service Cards List -->
    <div v-if="filteredCategories.length > 0" class="categories-container" :class="[`view--${viewMode}`]">
      <section
        v-for="category in filteredCategories"
        :id="categoryToId(category.id)"
        :key="category.id"
        class="category-group"
      >
        <div class="category-header">
          <div class="category-icon-wrapper">
            <Icon :icon="category.icon" />
          </div>
          <h2 class="category-title">
            {{ category.title }}
          </h2>
          <span class="category-count">{{ category.links.length }}</span>
        </div>

        <ul class="links-grid">
          <li v-for="link in category.links" :key="link.id" class="link-card-wrapper">
            <div
              class="link-card"
              :class="{
                'is-blocked': isServiceBlocked(link),
                'is-popular': isServicePopularIn(link),
              }"
            >
              <!-- Card Header -->
              <div class="link-card-header">
                <div class="favicon-wrapper">
                  <img :src="getFaviconUrl(link.url)" alt="" loading="lazy">
                </div>

                <div class="link-meta">
                  <a
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link-title"
                  >
                    <span>{{ link.name }}</span>
                    <Icon icon="mdi:open-in-new" class="external-icon" />
                  </a>

                  <div class="badges-row">
                    <!-- Popular in selected country badge -->
                    <span v-if="isServicePopularIn(link)" class="badge badge--popular">
                      <Icon icon="mdi:star" />
                      {{ isGlobalView ? 'Популярный' : `Топ в ${currentCountry.name}` }}
                    </span>

                    <!-- Blocked in country badge -->
                    <span v-if="isServiceBlocked(link)" class="badge badge--blocked">
                      <Icon icon="mdi:alert-circle" />
                      Не работает в {{ currentCountry.name }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Blocked warning banner -->
              <div v-if="isServiceBlocked(link)" class="blocked-warning-box">
                <Icon icon="mdi:alert-outline" class="box-icon" />
                <p>{{ isServiceBlocked(link)?.reason }}</p>
              </div>

              <!-- Country specific lifehack/note banner -->
              <div v-else-if="getServiceCountryNote(link)" class="country-note-box">
                <Icon icon="mdi:lightbulb-on-outline" class="box-icon" />
                <p>{{ getServiceCountryNote(link) }}</p>
              </div>

              <!-- Description -->
              <p class="link-description">
                {{ link.description }}
              </p>

              <!-- Card Footer -->
              <div class="link-card-footer">
                <div class="footer-badges">
                  <span v-if="link.recommended && !isServicePopularIn(link)" class="badge badge--recommended">
                    <Icon icon="mdi:thumb-up-outline" /> Наш выбор
                  </span>

                  <KitTooltip
                    v-if="link.isGlobal && !isGlobalView && !link.countries.includes(selectedCountryId)"
                    text="Глобальный международный сервис"
                  >
                    <span class="badge badge--global">
                      <Icon icon="mdi:earth" /> Глобальный
                    </span>
                  </KitTooltip>
                </div>

                <div v-if="link.tags && link.tags.length" class="mini-tags">
                  <span
                    v-for="tag in link.tags.slice(0, smAndDown ? 2 : 3)"
                    :key="tag"
                    class="mini-tag"
                  >
                    {{ tag }}
                  </span>
                  <span v-if="link.tags.length > (smAndDown ? 2 : 3)" class="more-tag">
                    +{{ link.tags.length - (smAndDown ? 2 : 3) }}
                  </span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Empty State -->
    <div v-else class="no-results">
      <div class="no-results-icon-box">
        <Icon icon="mdi:magnify-remove-outline" />
      </div>
      <h3 class="no-results-title">
        Ничего не найдено
      </h3>
      <p class="no-results-desc">
        Попробуйте изменить поисковый запрос, выбрать другую страну или сбросить активные фильтры.
      </p>
      <KitBtn variant="tonal" color="primary" class="reset-btn" @click="clearFilters">
        <Icon icon="mdi:refresh" />
        <span>Сбросить фильтры</span>
      </KitBtn>
    </div>
  </section>
</template>

<style scoped lang="scss">
.useful-links {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-bottom: 5rem;
}

/* Header */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  .page-title {
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--fg-primary-color);
    margin: 0;

    @include media-down(sm) {
      font-size: 1.5rem;
    }
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    margin: 0;
    line-height: 1.5;
  }
}

/* Country Selector Section */
.country-selector-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  padding: 1.25rem;
  box-shadow: var(--s-xs);

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;

    .section-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--fg-primary-color);

      .label-icon {
        color: var(--fg-accent-color);
        font-size: 1.2rem;
      }
    }
  }
}

.country-chips-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.country-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.9rem;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  border-radius: var(--r-full);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  .country-flag {
    font-size: 1.15rem;
    line-height: 1;
  }

  &:hover {
    border-color: var(--border-accent-color);
    color: var(--fg-primary-color);
    background-color: var(--bg-hover-color);
  }

  &.active {
    background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.25);
    border-color: var(--border-accent-color);
    color: var(--fg-accent-color);
    font-weight: 600;
  }
}

/* Country Tips Card */
.country-tips-card {
  background: linear-gradient(135deg, var(--bg-secondary-color) 0%, var(--bg-tertiary-color) 100%);
  border: 1px solid var(--border-accent-color);
  border-radius: var(--r-l);
  padding: 1.25rem;
  box-shadow: var(--s-s);
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .tips-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
    user-select: none;

    .tips-title-group {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;

      .tips-country-flag {
        font-size: 2rem;
        line-height: 1;
      }

      .tips-country-title {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--fg-primary-color);
        margin: 0 0 0.25rem 0;
      }

      .tips-country-desc {
        font-size: 0.875rem;
        color: var(--fg-secondary-color);
        margin: 0;
        line-height: 1.4;
      }
    }

    .tips-toggle-btn {
      background: none;
      border: 1px solid var(--border-secondary-color);
      border-radius: var(--r-s);
      color: var(--fg-secondary-color);
      padding: 0.35rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1.25rem;
      transition: all 0.2s ease;

      &:hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
      }
    }
  }

  .tips-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border-secondary-color);
  }

  .tip-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.85rem;
    border-radius: var(--r-m);
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    transition: transform 0.2s ease;

    .tip-icon-box {
      width: 32px;
      height: 32px;
      border-radius: var(--r-s);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 1.2rem;
    }

    &.tip--warning {
      border-color: rgba(239, 68, 68, 0.3);
      background-color: rgba(239, 68, 68, 0.04);

      .tip-icon-box {
        background-color: rgba(239, 68, 68, 0.12);
        color: #ef4444;
      }
    }

    &.tip--tip {
      border-color: rgba(16, 185, 129, 0.3);
      background-color: rgba(16, 185, 129, 0.04);

      .tip-icon-box {
        background-color: rgba(16, 185, 129, 0.12);
        color: #10b981;
      }
    }

    &.tip--info {
      border-color: rgba(59, 130, 246, 0.3);
      background-color: rgba(59, 130, 246, 0.04);

      .tip-icon-box {
        background-color: rgba(59, 130, 246, 0.12);
        color: #3b82f6;
      }
    }

    .tip-content {
      flex: 1;

      .tip-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--fg-primary-color);
        margin: 0 0 0.25rem 0;
      }

      .tip-text {
        font-size: 0.825rem;
        color: var(--fg-secondary-color);
        line-height: 1.4;
        margin: 0;
      }
    }
  }
}

/* Category Tabs Bar */
.category-tabs-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  .category-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    border-radius: var(--r-m);
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;

    .tab-count {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
      padding: 0.1rem 0.5rem;
      border-radius: var(--r-full);
      font-size: 0.75rem;
      font-weight: 600;
    }

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
      border-color: var(--border-primary-color);
    }

    &.active {
      background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.25);
      border-color: var(--border-accent-color);
      color: var(--fg-accent-color);
      font-weight: 600;

      .tab-count {
        background-color: var(--fg-accent-color);
        color: var(--fg-inverted-color, #ffffff);
      }
    }
  }
}

/* Tools Panel */
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
  min-width: 260px;

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

.tools-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;

  @include media-down(sm) {
    width: 100%;
    justify-content: space-between;
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
    flex: 1;
    .kit-dropdown {
      flex: 1;
    }
    .sort-btn {
      width: 100%;
      justify-content: center;
    }
  }
}

/* Active filters bar */
.active-filters-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 1rem;
  background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.2);
  border: 1px solid rgba(var(--bg-accent-overlay-color-rgb), 0.4);
  border-radius: var(--r-m);
  font-size: 0.875rem;

  .filters-summary-text {
    color: var(--fg-primary-color);
  }

  .reset-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: none;
    border: none;
    color: var(--fg-accent-color);
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

/* Categories Container */
.categories-container {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.category-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scroll-margin-top: 100px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-left: 4px;

  .category-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: var(--r-s);
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-accent-color);
    font-size: 1.25rem;
  }

  .category-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin: 0;
  }

  .category-count {
    font-size: 0.85rem;
    color: var(--fg-tertiary-color);
    font-weight: 600;
    margin-left: auto;
    background-color: var(--bg-secondary-color);
    padding: 0.2rem 0.6rem;
    border-radius: var(--r-full);
  }
}

/* Links Grid & List */
.links-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;

  .view--grid & {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
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
  padding: 1.15rem;
  height: 100%;
  transition: all 0.2s ease;
  position: relative;
  gap: 0.75rem;

  @include hover {
    & {
      border-color: var(--border-primary-color);
      transform: translateY(-2px);
      box-shadow: var(--s-m);
    }

    .link-title {
      color: var(--fg-accent-color);
    }
    .external-icon {
      color: var(--fg-accent-color);
      opacity: 1;
    }
  }

  &.is-popular {
    border-color: rgba(245, 158, 11, 0.4);
  }

  &.is-blocked {
    border-color: rgba(239, 68, 68, 0.3);
    opacity: 0.9;
  }
}

.link-card-header {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.favicon-wrapper {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--s-xs);

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.link-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
}

.link-title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  font-size: 1.05rem;
  text-decoration: none;
  transition: color 0.2s;
  width: fit-content;

  .external-icon {
    font-size: 0.95rem;
    color: var(--fg-tertiary-color);
    opacity: 0.6;
    transition: all 0.2s;
  }
}

.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.badge {
  font-size: 0.725rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;

  &.badge--popular {
    background-color: rgba(245, 158, 11, 0.12);
    color: #d97706;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  &.badge--blocked {
    background-color: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  &.badge--recommended {
    background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.2);
    color: var(--fg-accent-color);
    border: 1px solid rgba(var(--bg-accent-overlay-color-rgb), 0.4);
  }

  &.badge--global {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    border: 1px solid var(--border-secondary-color);
  }
}

.blocked-warning-box {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--r-s);
  font-size: 0.8rem;
  color: #ef4444;
  line-height: 1.35;

  .box-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  p {
    margin: 0;
  }
}

.country-note-box {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: rgba(var(--bg-accent-overlay-color-rgb), 0.2);
  border: 1px solid rgba(var(--bg-accent-overlay-color-rgb), 0.4);
  border-radius: var(--r-s);
  font-size: 0.8rem;
  color: var(--fg-primary-color);
  line-height: 1.35;

  .box-icon {
    font-size: 1.1rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
    margin-top: 1px;
  }

  p {
    margin: 0;
  }
}

.link-description {
  font-size: 0.875rem;
  color: var(--fg-secondary-color);
  line-height: 1.45;
  margin: 0;
  flex-grow: 1;

  .view--grid & {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.link-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;
}

.footer-badges {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.mini-tags {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;

  .mini-tag {
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-tertiary-color);
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .more-tag {
    color: var(--fg-tertiary-color);
    font-weight: 500;
  }
}

/* Empty State */
.no-results {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--fg-secondary-color);
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-l);
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  .no-results-icon-box {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: var(--bg-secondary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    color: var(--fg-tertiary-color);
    margin-bottom: 0.5rem;
  }

  .no-results-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin: 0;
  }

  .no-results-desc {
    max-width: 440px;
    font-size: 0.95rem;
    margin: 0 0 0.5rem 0;
    line-height: 1.4;
  }

  .reset-btn {
    margin-top: 0.5rem;
  }
}

/* Animations */
.fade-collapse-enter-active,
.fade-collapse-leave-active {
  transition: all 0.3s ease;
}

.fade-collapse-enter-from,
.fade-collapse-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
