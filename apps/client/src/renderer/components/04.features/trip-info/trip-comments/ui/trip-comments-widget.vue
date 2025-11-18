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
      <Icon icon="mdi:forum-outline" />
    </button>

    <KitDrawer
      v-model:open="isPanelOpen"
      width="500px"
      side="right"
      class="comments-widget-drawer"
    >
      <h2 class="drawer-title">
        {{ drawerTitle }}
      </h2>
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
.comments-widget-drawer {
  .drawer-title {
    padding: 20px;
    padding-bottom: 16px;
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 16px;
    border-bottom: 1px solid var(--border-secondary-color);

    h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
  }

  .drawer-content {
    padding: 0 8px;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}

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

  &:hover {
    color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
  }
}
</style>
