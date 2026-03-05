<script setup lang="ts">
import type { TripSection } from '~/shared/types/models/trip'
import { Icon } from '@iconify/vue'
import { KitBottomSheet } from '~/components/01.kit/kit-bottom-sheet'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
import { AppFooter } from '~/components/02.shared/app-footer'
import { AppHeader } from '~/components/02.shared/app-header'
import { BackgroundEffects } from '~/components/02.shared/background-effects'
import { ThemeManager } from '~/components/02.shared/theme-manager'
import { TripCommentsWidget } from '~/components/04.features/trip-info/trip-comments'
import { useModuleStore } from '~/components/05.modules/trip-info'
import { useTripPermissions } from '~/components/05.modules/trip-info/composables/use-trip-permissions'
import { vRipple } from '~/shared/directives/ripple'
import { CommentParentType } from '~/shared/types/models/comment'
import { useTripInfoLayout } from '../composables'
import AddSectionDialog from './dialogs/add-section-dialog.vue'
import EditSectionDialog from './dialogs/edit-section-dialog.vue'

const layout = useTripInfoLayout()
const route = useRoute()
const router = useRouter()

// @ts-expect-error используются в template
const { mainNavigationRef, navigationWrapperRef } = layout
const { plan, ui, routeGallery, memories, sections } = useModuleStore(['plan', 'ui', 'routeGallery', 'memories', 'sections'])
const { canEdit } = useTripPermissions()
const { mdAndDown } = useDisplay()

const tripId = computed(() => route.params.id as string)
const dayId = computed(() => route.query.day as string)
const isMapView = computed(() => route.query.section === 'map')

const { isLoading: isTripLoading, fetchError } = storeToRefs(plan)
const { isDaysPanelPinned, activeView, isParallelPlanView } = storeToRefs(ui)

if (tripId.value) {
  plan.fetchTripDetails(
    tripId.value,
    dayId.value,
    (loadedSections: TripSection[]) => {
      sections.setSections(loadedSections)
    },
  )
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
        class="content-wrapper"
        :class="[
          { 'has-error': fetchError },
          { 'is-panel-pinned': isDaysPanelPinned && !mdAndDown },
          { 'is-wide-mode': isParallelPlanView || isMapView },
          activeView,
        ]"
      >
        <div
          ref="mainNavigationRef"
          class="main-navigation"
        >
          <div class="main-navigation-left">
            <button v-ripple class="nav-button" title="Назад" @click="router.back()">
              <Icon icon="mdi:arrow-left" />
            </button>
          </div>

          <div ref="navigationWrapperRef" class="navigation-wrapper">
            <template v-if="isTripLoading">
              <KitSkeleton width="250px" height="40px" border-radius="12px" />
            </template>
            <template v-else>
              <button class="nav-arrow left" title="Предыдущая секция" @click="layout.navigate('prev')">
                <Icon icon="mdi:chevron-left" />
              </button>

              <div v-ripple class="current-section" @click="layout.handleCurrentSectionClick">
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
                  </ul>

                  <div v-if="canEdit && !ui.isViewMode" class="dropdown-footer">
                    <button class="add-section-btn" @click="ui.openAddSectionDialog">
                      <Icon icon="mdi:plus-circle-outline" />
                      <span>Добавить раздел</span>
                    </button>
                  </div>
                </div>
              </Transition>
            </template>
          </div>

          <div class="main-navigation-right">
            <template v-if="isTripLoading">
              <KitSkeleton width="40px" height="40px" border-radius="50%" />
            </template>
            <template v-else>
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
            </template>
          </div>
        </div>

        <KitDivider class="trip-info-divider">
          <Icon width="16" height="16" icon="mdi-axis-arrow-info" />
        </KitDivider>

        <slot />
      </div>
    </div>

    <BackgroundEffects />
    <AppFooter />
  </main>

  <ThemeManager />

  <KitBottomSheet
    v-model="layout.isDrawerOpen.value"
    title="Разделы"
  >
    <ul class="sheet-sections-list">
      <li
        v-for="item in layout.tabItems.value"
        :key="item.id"
        @click="layout.selectSection(item.id), layout.isDrawerOpen.value = false"
      >
        <Icon :icon="item.icon!" class="sheet-section-icon" />
        <span>{{ item.label }}</span>
      </li>
    </ul>

    <template v-if="canEdit && !ui.isViewMode" #footer>
      <button
        class="add-section-btn"
        @click="ui.openAddSectionDialog(), layout.isDrawerOpen.value = false"
      >
        <Icon icon="mdi:plus-circle-outline" />
        <span>Добавить раздел</span>
      </button>
    </template>
  </KitBottomSheet>

  <AddSectionDialog v-model:visible="ui.isAddSectionDialogOpen" @add-section="handleAddSection" />

  <EditSectionDialog
    v-model:visible="layout.isEditSectionDialogOpen.value"
    :section="layout.sectionToEdit.value"
    @save="layout.handleUpdateSection"
  />
</template>

<style scoped lang="scss">
.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  overflow: hidden;
  margin-top: -56px;
  padding-top: 56px;

  .trip-info-divider {
    margin: 0 auto;
    display: flex;
    align-items: center;
    max-width: 1000px;
    width: 100%;
    padding: 0 8px;
    padding-top: 16px;
    padding-bottom: 8px;
  }

  &-navigation {
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1000px;
    width: 100%;
    padding: 0 8px;
    padding-top: 16px;

    .nav-button {
      width: 40px;
      height: 40px;
      box-shadow: var(--s-s);
      border-radius: var(--r-full);
      border: 1px solid transparent;
      background-color: var(--bg-secondary-color);
      color: var(--fg-secondary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
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
      height: 40px;

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
        font-size: 1.4rem;
        font-weight: 600;
        color: var(--fg-primary-color);
        margin: 0;
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
  }
}

.content-wrapper {
  &.has-error {
    background: transparent;
  }

  &.is-panel-pinned {
    @media (max-width: 1800px) {
      margin-left: 440px;
    }
  }

  &.is-wide-mode {
    max-width: 100%;
    height: 100%;
    padding: 0;
    align-items: center;

    :deep() {
      .navigation-back-container,
      .controls,
      .day-header,
      .day-navigation,
      .divider-with-action {
        max-width: 1000px;
        width: 100%;
        margin-left: auto;
        margin-right: auto;
      }

      .divider-with-action {
        position: relative;
      }

      .trip-info-wrapper {
        .trip-info {
          justify-content: center;
          align-items: center;

          .divider {
            padding: 0 32px;
          }

          .view-content {
            padding: 0 32px;
            max-width: 1800px;
            margin: 0 auto;
            width: 100%;
          }
        }
      }
    }
  }
}

.sheet-sections-list {
  list-style: none;
  padding: 8px;
  margin: 0;

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

    .sheet-section-icon {
      font-size: 1.2rem;
      color: var(--fg-secondary-color);
      flex-shrink: 0;
    }

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }
  }
}

.add-section-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--r-s);
  border: 1px dashed var(--border-secondary-color);
  background-color: transparent;
  color: var(--fg-secondary-color);
  font-weight: 500;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s ease;
  font-size: 0.9rem;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
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
  padding: 0;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.sections-list {
  list-style: none;
  padding: 16px;
  margin: 0;
  column-count: 3;
  column-gap: 24px;
  overflow-y: auto;
  flex: 1;

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
}

.dropdown-footer {
  padding: 8px;
  border-top: 1px solid var(--border-secondary-color);
  background-color: var(--bg-tertiary-color);
  flex-shrink: 0;
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
      background-color: var(--bg-secondary-color);
      border-radius: var(--r-m);
      box-shadow: var(--s-s);

      .current-section {
        width: 100%;
        justify-content: center;
      }
    }

    &-left {
      width: auto;
      flex-grow: 1;
    }

    &-right {
      width: auto;
    }
  }
}
</style>
