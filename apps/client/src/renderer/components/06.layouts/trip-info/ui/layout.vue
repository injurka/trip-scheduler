<script setup lang="ts">
import type { TripSection } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitDrawer } from '~/components/01.kit/kit-drawer'
import { KitInput } from '~/components/01.kit/kit-input'
import { AppFooter } from '~/components/02.shared/app-footer'
import { AppHeader } from '~/components/02.shared/app-header'
import { BackgroundEffects } from '~/components/02.shared/background-effects'
import { ThemeManager } from '~/components/02.shared/theme-manager'
import { TripCommentsWidget } from '~/components/04.features/trip-info/trip-comments'
import { useModuleStore } from '~/components/05.modules/trip-info'
import { useTripPermissions } from '~/components/05.modules/trip-info/composables/use-trip-permissions'
import AddSectionDialog from '~/components/06.layouts/trip-info/ui/add-section-dialog.vue'
import { CommentParentType } from '~/shared/types/models/comment'
import { useTripInfoLayout } from '../composables'

const layout = useTripInfoLayout()
const route = useRoute()
const router = useRouter()
const { smAndDown } = useDisplay()

const { mainNavigationRef, navigationWrapperRef } = layout
const { plan, ui, routeGallery, memories, sections } = useModuleStore(['plan', 'ui', 'routeGallery', 'memories', 'sections'])
const store = useAppStore(['auth'])
const { canEdit } = useTripPermissions()

const tripId = computed(() => route.params.id as string)
const dayId = computed(() => route.query.day as string)

if (tripId.value) {
  plan.fetchTripDetails(
    tripId.value,
    dayId.value,
    (loadedSections: TripSection[]) => {
      sections.setSections(loadedSections)
    },
  )
  routeGallery.setTripId(tripId.value)
  routeGallery.fetchTripImages()
  memories.fetchMemories(tripId.value)
}

function handleAddSection(type: any) {
  sections.addSection(type)
  ui.closeAddSectionDialog()
}

function toggleMode() {
  const newMode = ui.isViewMode ? 'edit' : 'view'
  if (newMode === 'edit')
    ui.clearCollapsedState()

  ui.setInteractionMode(newMode)
}

onBeforeUnmount(() => {
  plan.reset()
  memories.reset()
  sections.reset()
  routeGallery.reset()
  ui.reset()
})
</script>

<template>
  <AppHeader />

  <main class="main">
    <div class="main-content">
      <div
        ref="mainNavigationRef"
        class="main-navigation"
      >
        <div class="main-navigation-left">
          <button class="nav-button" title="Назад" @click="router.back()">
            <Icon icon="mdi:arrow-left" />
          </button>
        </div>

        <div ref="navigationWrapperRef" class="navigation-wrapper">
          <button class="nav-arrow left" title="Предыдущая секция" @click="layout.navigate('prev')">
            <Icon icon="mdi:chevron-left" />
          </button>

          <div class="current-section" @click="layout.handleCurrentSectionClick">
            <Icon v-if="layout.activeTab.value?.icon" :icon="layout.activeTab.value.icon" class="current-section-icon" />
            <h1 class="current-section-title">
              {{ layout.activeTab.value?.label }}
            </h1>
            <Icon icon="mdi:chevron-down" class="chevron-icon" :class="{ 'is-open': layout.isLayoutDropdownOpen.value }" />
          </div>

          <button class="nav-arrow right" title="Следующая секция" @click="layout.navigate('next')">
            <Icon icon="mdi:chevron-right" />
          </button>

          <Transition name="fade-dropdown">
            <div v-if="!layout.isMobile.value && layout.isLayoutDropdownOpen.value" class="sections-dropdown-panel">
              <ul class="sections-list">
                <li v-for="item in layout.tabItems.value" :key="item.id" @click="layout.selectSection(item.id)">
                  <Icon :icon="item.icon!" class="section-item-icon" />
                  <span>{{ item.label }}</span>
                </li>
                <li v-if="store.auth.isAuthenticated" class="add-section-item-wrapper">
                  <button class="add-section-btn" @click="ui.openAddSectionDialog">
                    <Icon icon="mdi:plus-circle-outline" />
                    <span>Добавить раздел</span>
                  </button>
                </li>
              </ul>
            </div>
          </Transition>
        </div>

        <div class="main-navigation-right">
          <TripCommentsWidget
            v-if="dayId && layout.activeTab.value?.id === 'daily-route'"
            :parent-id="dayId"
            :parent-type="CommentParentType.DAY"
          />
          <button
            v-if="canEdit"
            class="nav-button"
            :title="ui.isViewMode ? 'Перейти в режим редактирования' : 'Перейти в режим просмотра'"
            @click="toggleMode"
          >
            <Icon width="18" height="18" :icon="ui.isViewMode ? 'mdi:pencil-outline' : 'mdi:eye-outline'" />
          </button>
          <!-- TODO Later -->
          <!-- <KitDropdown :items="layout.menuItems.value" @update:model-value="layout.handleMenuAction">
            <template #trigger>
              <button class="nav-button" title="Меню">
                <Icon icon="mdi:dots-vertical" />
              </button>
            </template>
          </KitDropdown> -->
        </div>
      </div>
      <KitDivider class="trip-info-divider">
        <Icon width="16" height="16" icon="mdi-axis-arrow-info" />
      </KitDivider>

      <slot />
    </div>

    <BackgroundEffects />
    <AppFooter />
  </main>

  <ThemeManager />

  <!-- Drawer для мобильных -->
  <KitDrawer
    v-model:open="layout.isDrawerOpen.value"
    side="right"
    class="sections-drawer"
    :width="smAndDown ? '100%' : '400px'"
  >
    <div class="drawer-header">
      <h2>
        <span>Разделы</span>
      </h2>
    </div>
    <ul class="drawer-list">
      <li v-for="item in layout.tabItems.value" :key="item.id" @click="layout.selectSection(item.id)">
        <Icon :icon="item.icon!" class="drawer-item-icon" />
        <span>{{ item.label }}</span>
      </li>
    </ul>
    <div class="drawer-footer">
      <button
        class="add-section-btn"
        @click=" ui.openAddSectionDialog(), layout.isDrawerOpen.value = false "
      >
        <Icon icon="mdi:plus-circle-outline" />
        <span>Добавить раздел</span>
      </button>
    </div>
  </KitDrawer>

  <!-- Диалог добавления новой секции -->
  <AddSectionDialog v-model:visible="ui.isAddSectionDialogOpen" @add-section="handleAddSection" />

  <!-- Диалог редактирования раздела -->
  <KitDialogWithClose
    v-if="layout.sectionToEdit.value"
    v-model:visible="layout.isEditSectionDialogOpen.value"
    title="Редактировать раздел"
    icon="mdi:pencil"
    :max-width="400"
  >
    <form class="add-section-form" @submit.prevent="layout.handleUpdateSection">
      <KitInput
        v-model="layout.sectionToEdit.value.title"
        label="Название раздела"
        placeholder="Например, 'Билеты' или 'Отели'"
        required
      />
      <div class="icon-picker">
        <label>Иконка</label>
        <KitInput v-model="layout.iconSearchQueryEdit.value" placeholder="Поиск иконки (напр. 'car')" icon="mdi:magnify" />
        <div class="icon-picker-grid">
          <button
            v-for="icon in layout.filteredIconsEdit.value"
            :key="icon"
            type="button"
            class="icon-option"
            :class="{ 'is-active': layout.sectionToEdit.value.icon === icon }"
            @click="layout.sectionToEdit.value.icon = icon"
          >
            <Icon :icon="icon" />
          </button>
        </div>
      </div>
      <KitBtn type="submit" :disabled="!layout.sectionToEdit.value.title.trim()">
        Сохранить
      </KitBtn>
    </form>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;

  .trip-info-divider {
    margin: 0 auto;
    display: flex;
    align-items: center;
    max-width: 1000px;
    width: 100%;
    padding: 0 8px;
    background: var(--bg-primary-color);
    padding-top: 32px;
  }

  &-navigation {
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1000px;
    width: 100%;
    padding: 0 8px;
    background: var(--bg-primary-color);
    padding-top: 16px;

    .nav-button {
      width: 40px;
      height: 40px;
      border-radius: var(--r-full);
      border: 1px solid transparent;
      background-color: var(--bg-secondary-color);
      color: var(--fg-secondary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;

      &:hover {
        color: var(--fg-accent-color);
        background-color: var(--bg-hover-color);
        border-color: var(--border-secondary-color);
      }
    }

    .navigation-wrapper {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;

      .nav-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        border-radius: var(--r-full);
        border: 1px solid transparent;
        background-color: transparent;
        color: var(--fg-secondary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        opacity: 0;
        visibility: hidden;
        z-index: 1;

        &.left {
          left: -50px;
        }

        &.right {
          right: -50px;
        }

        &:hover {
          color: var(--fg-accent-color);
          background-color: var(--bg-hover-color);
          border-color: var(--border-secondary-color);
        }
      }

      &:hover .nav-arrow {
        opacity: 1;
        visibility: visible;
      }
    }

    .current-section {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 24px;
      border-radius: var(--r-m);
      cursor: pointer;
      transition: background-color 0.2s ease;
      text-align: center;

      &:hover {
        background-color: var(--bg-hover-color);
      }

      .chevron-icon {
        font-size: 1.2rem;
        color: var(--fg-secondary-color);
        transition: transform 0.2s ease;
        margin-left: 4px;

        &.is-open {
          transform: rotate(180deg);
        }
      }

      &-icon {
        font-size: 1.5rem;
        color: var(--fg-secondary-color);
      }

      &-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--fg-primary-color);
        margin: 0;
        line-height: 1.2;
        font-family: 'Sansation';

        @include media-down(sm) {
          font-size: 1.1rem;
        }
      }
    }

    &-right,
    &-left {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 136px;
    }
    &-right {
      justify-content: flex-end;
    }
    &-left {
      width: 136px;
    }
  }
  &-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }
}

.sections-drawer {
  .drawer-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-secondary-color);
    h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
  }

  .drawer-list {
    list-style: none;
    padding: 8px;
    margin: 0;
    flex: 1;
    overflow-y: auto;

    li {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      border-radius: var(--r-m);
      cursor: pointer;
      transition: background-color 0.2s ease;
      font-size: 1rem;
      color: var(--fg-secondary-color);

      .drawer-item-icon {
        font-size: 1.2rem;
        color: var(--fg-secondary-color);
      }

      &:hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
      }
    }
  }

  .drawer-footer {
    padding: 16px;
    border-top: 1px solid var(--border-secondary-color);

    .add-section-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--r-s);
      border: 1px solid var(--border-secondary-color);
      background-color: transparent;
      color: var(--fg-secondary-color);
      font-weight: 500;
      cursor: pointer;
      width: 100%;

      transition: all 0.2s ease;

      &:hover {
        color: var(--fg-accent-color);
        border-color: var(--fg-accent-color);
      }
    }
  }
}

.sections-dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: 1000px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-l);
  box-shadow: var(--s-xl);
  z-index: 10;
  padding: 16px;
  max-height: 50vh;
  overflow-y: auto;
}

.sections-list {
  list-style: none;
  padding: 0;
  margin: 0;
  column-count: 3;
  column-gap: 24px;

  li {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    border-radius: var(--r-m);
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-size: 1rem;
    color: var(--fg-secondary-color);
    break-inside: avoid;
    page-break-inside: avoid;

    .section-item-icon {
      font-size: 1.2rem;
      color: var(--fg-secondary-color);
      flex-shrink: 0;
    }

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }
  }

  .add-section-item-wrapper {
    padding: 0;
    margin: 0;

    &:hover {
      background: none;
    }

    .add-section-btn {
      display: inline-flex;
      justify-content: flex-start;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: var(--r-s);
      color: var(--fg-secondary-color);
      font-weight: 400;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 1rem;
      width: 100%;

      &:hover {
        color: var(--fg-accent-color);
        background-color: var(--bg-hover-color);
      }
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
  transform: translateX(-50%) translateY(-10px);
}

.add-section-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px;
}

.icon-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}
.icon-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 8px;
  max-height: 142px;
  overflow-y: auto;
  background-color: var(--bg-secondary-color);
  padding: 8px;
  border-radius: var(--r-s);

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
.icon-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-s);
  border: 1px solid transparent;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  font-size: 1.4rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
  &.is-active {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}

@include media-down(lg) {
  .sections-dropdown-panel {
    width: calc(100vw - 48px);
  }
  .sections-list {
    column-count: 2;
  }
}

@include media-down(sm) {
  .main-navigation {
    flex-wrap: wrap;
    row-gap: 16px;

    .navigation-wrapper {
      order: 3;
      width: 100%;
      justify-content: center;
    }

    &-left {
      width: auto;
      flex-grow: 1;
    }

    &-right {
      width: auto;
    }
  }

  .sections-list {
    column-count: 1;
  }
}
</style>
