<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInput } from '~/components/01.kit/kit-input'
import { NavigationBack } from '~/components/02.shared/navigation-back'

import { usePostDraftStore } from '../../store/post-draft.store'
import { usePostStore } from '../../store/post.store'
import PostDetailsView from '../details/post-details-view.vue'
import StageEditor from './stage-editor.vue'

const router = useRouter()
const draftStore = usePostDraftStore()
const postStore = usePostStore()

const { post } = storeToRefs(draftStore)
const isPreviewMode = ref(false)
const isPublishing = ref(false)

onMounted(() => {
  draftStore.initDraft()
})

async function handlePublish() {
  if (!post.value.title) {
    // eslint-disable-next-line no-alert
    alert('Пожалуйста, укажите заголовок')
    return
  }

  isPublishing.value = true
  try {
    await postStore.createPost(post.value)
    router.push('/post/list')
  }
  catch (e) {
    console.error(e)
  }
  finally {
    isPublishing.value = false
  }
}

// Вычисляем данные для предпросмотра, добавляя заглушки для обязательных полей, которых может не быть в черновике
const previewData = computed(() => ({
  ...post.value,
  author: { id: 'me', name: 'Автор (Вы)', avatarUrl: '' },
  stats: { likes: 0, saves: 0, isLiked: false, isSaved: false },
  statsDetail: { views: 0, budget: '$$', duration: '...' },
}))
</script>

<template>
  <div class="editor-page">
    <header class="editor-topbar">
      <div class="left">
        <NavigationBack />
        <h2 class="page-title">
          {{ isPreviewMode ? 'Предпросмотр' : 'Новый пост' }}
        </h2>
      </div>

      <div class="actions">
        <!-- Toggle Preview -->
        <button class="preview-toggle" @click="isPreviewMode = !isPreviewMode">
          <Icon :icon="isPreviewMode ? 'mdi:pencil-outline' : 'mdi:eye-outline'" />
          <span>{{ isPreviewMode ? 'Редактировать' : 'Просмотр' }}</span>
        </button>

        <div class="divider" />

        <KitBtn
          icon="mdi:check"
          :loading="isPublishing"
          @click="handlePublish"
        >
          Опубликовать
        </KitBtn>
      </div>
    </header>

    <!-- MODE: PREVIEW -->
    <div v-if="isPreviewMode" class="preview-container">
      <PostDetailsView :post="previewData" />
    </div>

    <!-- MODE: EDITOR -->
    <div v-else class="editor-container">
      <!-- 1. Hero Section Edit -->
      <section class="meta-section">
        <div class="cover-upload-placeholder">
          <Icon icon="mdi:camera-plus" size="32" />
          <span>Загрузить обложку</span>
        </div>

        <div class="main-inputs">
          <KitInput v-model="post.title" label="Заголовок" placeholder="Например: Выходные в Питере" size="lg" />
          <KitInput v-model="post.insight" label="Главный инсайт" placeholder="Короткий совет или мысль..." type="textarea" :rows="2" />

          <div class="tags-inputs">
            <KitInput v-model="post.location.city" label="Город" placeholder="Город" />
            <!-- Additional inputs for category/emoji can be here -->
          </div>
        </div>
      </section>

      <!-- 2. Timeline Editor -->
      <section class="timeline-section">
        <h3 class="section-title">
          Таймлайн путешествия
        </h3>

        <draggable
          :list="post.stages"
          item-key="id"
          handle=".drag-handle"
          ghost-class="ghost-stage"
          class="stages-list"
        >
          <template #item="{ element, index }">
            <StageEditor :stage="element" :index="index" />
          </template>
        </draggable>

        <KitBtn
          variant="tonal"
          icon="mdi:plus-circle-outline"
          class="add-stage-btn"
          @click="draftStore.addStage"
        >
          Добавить этап
        </KitBtn>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.editor-page {
  background-color: var(--bg-primary-color);
  min-height: 100vh;
  padding-bottom: 40px;
}

.editor-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(var(--bg-primary-color-rgb), 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-secondary-color);
}

.left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 500;
  color: var(--fg-secondary-color);
  padding: 6px 12px;
  border-radius: var(--r-s);
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
}

.divider {
  width: 1px;
  height: 24px;
  background-color: var(--border-secondary-color);
}

/* Editor Container */
.editor-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Preview Container (Full width for detail view) */
.preview-container {
  background-color: var(--bg-primary-color);
}

/* Meta Section Styles from previous step... */
.meta-section {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 24px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.cover-upload-placeholder {
  background: var(--bg-tertiary-color);
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-m);
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }
}

.main-inputs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tags-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-stage-btn {
  width: 100%;
  justify-content: center;
  padding: 12px;
  margin-top: 16px;
}

.ghost-stage {
  opacity: 0.5;
  border: 2px dashed var(--fg-accent-color);
}
</style>
