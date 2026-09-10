<script setup lang="ts">
import type { CommentParentType } from '~/shared/types/models/comment'
import { Icon } from '@iconify/vue'
import { KitDrawer } from '~/components/01.kit/kit-drawer'
import { useTripCommentsStore } from '../store/trip-comments.store'
import TripComments from './trip-comments.vue'

interface Props {
  parentId: string
  parentType: CommentParentType
}

const props = defineProps<Props>()

const commentsStore = useTripCommentsStore()
const isPanelOpen = ref(false)

const drawerTitle = computed(() => props.parentType === 'day' ? 'Обсуждение дня' : 'Обсуждение путешествия')

watch(isPanelOpen, (isOpen) => {
  if (isOpen) {
    const collection = commentsStore.getCommentCollectionByParentId(props.parentId)
    if (!collection || collection.comments.length === 0) {
      commentsStore.fetchComments(props.parentId)
    }
  }
})
</script>

<template>
  <div class="comments-widget">
    <button class="widget-trigger" @click="isPanelOpen = true">
      <Icon icon="mdi:forum-outline" width="18" height="18" />
    </button>

    <KitDrawer
      v-model:open="isPanelOpen"
      width="500px"
      side="right"
      class="comments-widget-drawer"
    >
      <header class="drawer-header">
        <div class="header-title">
          <Icon icon="mdi:forum-outline" />
          <h2>{{ drawerTitle }}</h2>
        </div>
      </header>
      <div class="drawer-content">
        <TripComments
          :parent-id="parentId"
          :parent-type="parentType"
        />
      </div>
    </KitDrawer>
  </div>
</template>

<style scoped lang="scss">
.widget-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--fg-secondary-color);
  font-size: 1.2rem;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s ease;
  width: 40px;
  height: 40px;

  &:hover {
    color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  padding-top: calc(16px + var(--safe-area-inset-top));
  padding-right: 56px;
  border-bottom: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
  box-sizing: border-box;

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.2rem;
    min-width: 0;

    h2 {
      font-size: inherit;
      font-weight: 600;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: var(--font-accent);
    }

    .iconify {
      font-size: 1.4rem;
      color: var(--fg-secondary-color);
      flex-shrink: 0;
    }
  }
}

.drawer-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 16px;
  padding-bottom: calc(12px + var(--safe-area-inset-bottom));
  box-sizing: border-box;

  :deep(.comments-section) {
    flex: 1;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }
}
</style>

<style lang="scss">
.drawer-content-wrapper.comments-widget-drawer {
  top: 0 !important;
  bottom: 0 !important;
  height: 100% !important;
  max-height: 100dvh !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;

  .close-button {
    top: calc(16px + var(--safe-area-inset-top)) !important;
    right: 16px !important;
  }
}
</style>
