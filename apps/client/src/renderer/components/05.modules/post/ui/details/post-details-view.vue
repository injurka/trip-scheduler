<script setup lang="ts">
import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'
import type { PostDetail } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { TripComments } from '~/components/04.features/trip-info/trip-comments'
import { useToast } from '~/shared/composables/use-toast'
import { CommentParentType } from '~/shared/types/models/comment'
import { usePostStore } from '../../store/post.store'
import PostHero from './post-hero.vue'
import PostMapView from './post-map-view.vue'
import TimelineStage from './timeline-stage.vue'

const props = defineProps<{ post: PostDetail, isPreviewMode?: boolean }>()

const router = useRouter()
const store = usePostStore()
const toast = useToast()
const confirm = useConfirm()

const activeStageId = ref(props.post.stages?.[0]?.id)
const isMapVisible = ref(false)
const isMapPinned = ref(false)

const menuItems: KitDropdownItem[] = [
  { label: 'Редактировать', value: 'edit', icon: 'mdi:pencil' },
  { label: 'Удалить', value: 'delete', icon: 'mdi:trash-can-outline', isDestructive: true },
]

const navScrollerRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateScrollState() {
  const el = navScrollerRef.value
  if (!el)
    return

  const scrollLeeway = 5
  canScrollLeft.value = el.scrollLeft > scrollLeeway
  canScrollRight.value = el.scrollLeft < (el.scrollWidth - el.clientWidth - scrollLeeway)
}

useResizeObserver(navScrollerRef, () => {
  updateScrollState()
})

onMounted(() => {
  setTimeout(() => {
    updateScrollState()
  }, 150)
})

async function handleMenuAction(action: string) {
  if (action === 'edit') {
    router.push(AppRoutePaths.Post.Edit(props.post.id))
  }
  else if (action === 'delete') {
    const isConfirmed = await confirm({
      title: 'Вы уверены, что хотите удалить этот пост?',
      description: 'Это действие необратимо. Все ваши данные будут удалены.',
      type: 'danger',
      confirmText: 'Да, удалить пост',
    })

    if (isConfirmed) {
      store.deletePost(props.post.id)
      toast.success('Пост удален')
      router.push(AppRoutePaths.Post.List)
    }
  }
}

function scrollToStage(id: string) {
  activeStageId.value = id
  const el = document.getElementById(`stage-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function pinMap() {
  isMapVisible.value = true
  isMapPinned.value = true
}
</script>

<template>
  <div class="post-details-page">
    <div v-if="!isPreviewMode" class="nav-overlay">
      <NavigationBack />
    </div>

    <div v-if="!isPreviewMode" class="actions-overlay">
      <KitDropdown
        :items="menuItems"
        align="end"
        @update:model-value="handleMenuAction"
      >
        <template #trigger>
          <KitBtn variant="text" icon="mdi:dots-horizontal" class="more-btn" />
        </template>
      </KitDropdown>
    </div>

    <PostHero :post="post" />

    <div class="layout-wrapper" :class="{ 'has-sidebar': isMapPinned }">
      <div class="main-column">
        <div
          v-if="post.stages && post.stages.length > 0"
          class="sticky-nav"
          :class="{
            'can-scroll-left': canScrollLeft,
            'can-scroll-right': canScrollRight,
          }"
        >
          <div
            ref="navScrollerRef"
            class="nav-scroller"
            @scroll="updateScrollState"
          >
            <button
              v-for="stage in post.stages"
              :key="stage.id"
              class="nav-tab"
              :class="{ active: activeStageId === stage.id }"
              @click="scrollToStage(stage.id)"
            >
              {{ stage.title }}
            </button>
          </div>
        </div>

        <div class="timeline-container">
          <slot name="timeline" />

          <template v-if="post.stages">
            <div
              v-for="(stage, index) in post.stages"
              :id="`stage-${stage.id}`"
              :key="stage.id"
              class="stage-wrapper"
            >
              <TimelineStage
                :stage="stage"
                :is-last="index === post.stages.length - 1"
              />
            </div>

            <div v-if="post.stages.length === 0" class="empty-state">
              <p>Автор еще не добавил этапы в этот маршрут.</p>
            </div>
          </template>
        </div>
      </div>

      <div class="sidebar-column" :class="{ 'is-active': isMapPinned }">
        <PostMapView
          v-model:visible="isMapVisible"
          v-model:pinned="isMapPinned"
          :post="post"
        />
      </div>
    </div>

    <div v-if="!isPreviewMode" class="bottom-container">
      <KitDivider class="comments-divider">
        Обсуждение
      </KitDivider>

      <section class="comments-section">
        <TripComments
          :parent-id="post.id"
          :parent-type="CommentParentType.POST"
        />
      </section>
    </div>

    <div v-if="!isMapPinned" class="map-fab-group">
      <button class="fab-main" title="Показать на карте" @click="isMapVisible = true">
        <Icon icon="mdi:map" />
        <span class="fab-text">Карта</span>
      </button>
      <div class="fab-divider" />
      <button class="fab-pin" title="Закрепить рядом с текстом" @click="pinMap">
        <Icon icon="mdi:pin" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.post-details-page {
  position: relative;
  background-color: var(--bg-primary-color);
  min-height: 100vh;
  padding-bottom: 24px;
}
.nav-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
}
.actions-overlay {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;

  .more-btn {
    background-color: rgba(var(--bg-secondary-color-rgb), 0.5);
    backdrop-filter: blur(4px);
    border-radius: 50%;
    color: var(--fg-primary-color);
    width: 32px;
    height: 32px;
    padding: 0;

    &:hover {
      background-color: var(--bg-secondary-color);
    }
  }
}

/* Обновленный Layout для поддержки сайдбара */
.layout-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 8px;
  transition: max-width 0.3s ease;

  &.has-sidebar {
    max-width: 1240px;
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 32px;
    align-items: start;
  }
}

.main-column {
  width: 100%;
  min-width: 0;
}

.sidebar-column {
  display: none;

  &.is-active {
    display: block;
    position: sticky;
    top: 24px;
    height: calc(100vh - 48px);
    align-self: start; /* Ключевое свойство для работы sticky внутри grid */
    z-index: 10;
  }
}

/* Контейнер под сеткой (Комментарии) */
.bottom-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 8px;
}

.sticky-nav {
  position: relative;
  background: rgba(var(--bg-primary-color-rgb), 0.8);
  padding: 8px 0;
  margin-bottom: 24px;
  border-radius: var(--r-xl);
  border: 1px solid var(--border-secondary-color);
  box-shadow: var(--s-m);
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
    pointer-events: none;
    width: 40px;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
  }

  &::before {
    left: 0;
    background: linear-gradient(to right, var(--bg-primary-color) 20%, transparent 100%);
  }

  &::after {
    right: 0;
    background: linear-gradient(to left, var(--bg-primary-color) 20%, transparent 100%);
  }

  &.can-scroll-left::before {
    opacity: 1;
  }

  &.can-scroll-right::after {
    opacity: 1;
  }
}
.nav-scroller {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding: 0 8px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}
.nav-tab {
  padding: 6px 12px;
  border-radius: var(--r-full);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  border: 1px solid transparent;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--fg-primary-color);
  }

  &.active {
    background: var(--fg-accent-color);
    color: white;
  }
}
.timeline-container {
  margin-top: 16px;
  /* Убрана минимальная высота, чтобы комментарии подтягивались ближе, если контента мало */
}
.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--fg-secondary-color);
  font-style: italic;
}
.comments-divider {
  margin: 40px 0 24px;
}
.comments-section {
  background: var(--bg-secondary-color);
  border-radius: var(--r-l);
  padding: 16px;
  border: 1px solid var(--border-secondary-color);
}

/* Стили плавающей кнопки FAB */
.map-fab-group {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  background-color: var(--fg-accent-color);
  border-radius: 30px;
  box-shadow: 0 4px 15px rgba(var(--fg-accent-color-rgb), 0.4);
  z-index: 20;
  overflow: hidden;
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(var(--fg-accent-color-rgb), 0.5);
  }
}

.fab-main {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  background: transparent;
  border: none;
  padding: 12px 16px 12px 20px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;

  .iconify {
    font-size: 1.2rem;
  }
}

.fab-divider {
  width: 1px;
  height: 24px;
  background-color: rgba(255, 255, 255, 0.3);
}

.fab-pin {
  color: white;
  background: transparent;
  border: none;
  padding: 12px 20px 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  .iconify {
    font-size: 1.2rem;
    transition: transform 0.2s;
  }

  &:hover .iconify {
    transform: scale(1.1);
  }
}

@include media-down(md) {
  .layout-wrapper.has-sidebar {
    grid-template-columns: 1fr;
    max-width: 800px;
  }

  .sidebar-column.is-active {
    position: relative;
    top: 0;
    height: 400px;
    margin-bottom: 24px;
    z-index: 1;
  }
}

@include media-down(sm) {
  .map-fab-group {
    bottom: 20px;
    right: 20px;
    border-radius: 50%;
  }
  .fab-main {
    padding: 14px;
    .fab-text {
      display: none;
    }
  }
  .fab-divider,
  .fab-pin {
    display: none;
  }
}
</style>
