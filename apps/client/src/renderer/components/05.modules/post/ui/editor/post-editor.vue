<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'

import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useToast } from '~/shared/composables/use-toast'
import { MOCK_COUNTRY_DATA } from '../../data/countries'
import { usePostDraftStore } from '../../store/post-draft.store'
import { usePostStore } from '../../store/post.store'
import PostDetailsView from '../details/post-details-view.vue'
import StageEditor from './stage-editor.vue'
import MediaLibraryPicker from './tools/media-library-picker.vue'
import PostMapPicker from './tools/post-map-picker.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const draftStore = usePostDraftStore()
const postStore = usePostStore()

const { post } = storeToRefs(draftStore)
const isPreviewMode = ref(false)
const isPublishing = ref(false)
const isEditMode = ref(false)
const isLoading = ref(true)

const isMediaLibraryOpen = ref(false)
const isMapPickerOpen = ref(false)

function openLibraryManage() {
  isMediaLibraryOpen.value = true
}

function handleMapConfirm(coords: { lat: number, lng: number }) {
  if (post.value) {
    post.value.latitude = coords.lat
    post.value.longitude = coords.lng
  }
}

const tempTag = ref('')

function addTag() {
  const val = tempTag.value.trim()
  if (val && post.value) {
    if (post.value.tags.includes(val)) {
      toast.warn(`Тег "${val}" уже добавлен`)
      tempTag.value = ''
      return
    }
    draftStore.addTag(val)
    tempTag.value = ''
  }
}

const countryOptions = computed(() => {
  return MOCK_COUNTRY_DATA.map(c => ({
    value: c.name.rus,
    label: c.name.rus,
    flag: c.flag,
  }))
})

async function handlePublish() {
  if (!post.value)
    return

  if (!post.value.title) {
    toast.error('Пожалуйста, укажите заголовок')
    return
  }
  if (!post.value.country) {
    toast.error('Пожалуйста, выберите страну')
    return
  }

  isPublishing.value = true
  try {
    const postId = await draftStore.savePost(!isEditMode.value, 'completed')
    toast.success(isEditMode.value ? 'Пост обновлен!' : 'Пост успешно опубликован!')
    if (postId) {
      router.push(AppRoutePaths.Post.Details(postId))
    }
  }
  catch (e) {
    console.error(e)
    toast.error('Ошибка при сохранении поста')
  }
  finally {
    isPublishing.value = false
  }
}

const previewData = computed(() => ({
  ...post.value,
  user: { id: 'me', name: 'Автор (Вы)', avatarUrl: '' },
  stats: post.value?.stats || { likes: 0, saves: 0, isLiked: false, isSaved: false },
}))

async function loadPostForEditor() {
  isLoading.value = true
  const id = route.params.id as string

  if (id) {
    isEditMode.value = true
    const fullPost = await postStore.fetchPostById(id)

    if (fullPost) {
      draftStore.initDraft(fullPost)
    }
    else {
      toast.error('Пост для редактирования не найден')
      router.replace(AppRoutePaths.Post.List)
    }
  }
  else {
    isEditMode.value = false
    draftStore.initDraft()
  }
  isLoading.value = false
}

onMounted(() => {
  loadPostForEditor()
})
</script>

<template>
  <div class="editor-page">
    <NavigationBack />

    <header class="editor-topbar">
      <div class="left">
        <h2 class="page-title">
          {{ isPreviewMode ? 'Предпросмотр' : (isEditMode ? 'Редактирование' : 'Новый пост') }}
        </h2>
      </div>

      <div class="actions">
        <button v-if="!isPreviewMode" class="action-icon-btn" title="Медиатека" @click="openLibraryManage">
          <Icon icon="mdi:image-multiple-outline" />
        </button>

        <button class="preview-toggle" @click="isPreviewMode = !isPreviewMode">
          <Icon :icon="isPreviewMode ? 'mdi:pencil-outline' : 'mdi:eye-outline'" />
          <span class="btn-label">{{ isPreviewMode ? 'Редактировать' : 'Просмотр' }}</span>
        </button>
      </div>
    </header>

    <div v-if="isLoading" class="loading-state">
      Загрузка редактора...
    </div>

    <div v-else-if="isPreviewMode && post" class="preview-container">
      <PostDetailsView :post="previewData" />
    </div>

    <div v-else-if="post" class="editor-container">
      <section class="meta-section">
        <div class="cover-area" @click="openLibraryManage">
          <div v-if="post.media.length > 0" class="cover-preview">
            <KitImage :src="post.media[0].url" object-fit="cover" />
            <div class="cover-overlay">
              <button class="change-btn">
                <Icon icon="mdi:camera-retake-outline" />
                <span>Управлять медиа</span>
              </button>
            </div>
          </div>
          <div v-else class="cover-placeholder">
            <Icon icon="mdi:camera-plus" width="32" height="32" />
            <span>Добавить главное фото</span>
          </div>
        </div>

        <div class="main-inputs">
          <KitInput v-model="post.title" label="Название маршрута" />
          <KitInput v-model="post.insight" label="Главный инсайт" placeholder="Короткий совет..." type="textarea" :rows="2" />
        </div>
      </section>

      <section class="details-section">
        <h3 class="section-title">
          Детали
        </h3>

        <div class="details-grid">
          <div class="field-group">
            <label>Локация</label>
            <div class="location-inputs">
              <div class="country-selector">
                <KitSelectWithSearch
                  v-model="post.country"
                  :items="countryOptions"
                  placeholder="Страна"
                  size="sm"
                >
                  <template #item="{ item }">
                    <img
                      v-if="(item as any).flag"
                      :src="(item as any).flag"
                      class="option-flag"
                      alt=""
                      loading="lazy"
                    >
                    <span>{{ item.label }}</span>
                  </template>
                </KitSelectWithSearch>
              </div>

              <button
                class="map-btn"
                :class="{ 'has-coords': post.latitude }"
                title="Указать на карте"
                @click="isMapPickerOpen = true"
              >
                <Icon icon="mdi:map-marker-radius" />
              </button>
            </div>
          </div>

          <div class="field-group dual">
            <div>
              <label>Бюджет</label>
              <KitInput v-model="post.statsDetail.budget" placeholder="Напр. $50 / Бесплатно" size="sm" />
            </div>
            <div>
              <label>Время</label>
              <KitInput v-model="post.statsDetail.duration" placeholder="Напр. 2 часа / Весь день" size="sm" />
            </div>
          </div>

          <div class="field-group">
            <label>Теги (#Прогулка, #Архитектура)</label>
            <div class="tags-input-wrapper">
              <div v-for="tag in post.tags" :key="tag" class="tag-chip">
                #{{ tag }}
                <span class="remove" @click="draftStore.removeTag(tag)">×</span>
              </div>
              <input
                v-model="tempTag"
                placeholder="+ Добавить"
                class="tag-input"
                @keydown.enter="addTag"
                @blur="addTag"
              >
            </div>
          </div>
        </div>
      </section>

      <section v-if="post.stages" class="timeline-section">
        <h3 class="section-title">
          Таймлайн
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

      <div class="editor-submit">
        <KitBtn
          icon="mdi:check"
          :loading="isPublishing"
          variant="subtle"
          @click="handlePublish"
        >
          {{ isEditMode ? 'Сохранить изменения' : 'Опубликовать' }}
        </KitBtn>
      </div>
    </div>

    <MediaLibraryPicker
      v-model:visible="isMediaLibraryOpen"
      mode="manage"
      @confirm="isMediaLibraryOpen = false"
    />

    <PostMapPicker
      v-model:visible="isMapPickerOpen"
      :initial-coords="{ lat: post?.latitude ?? 0, lng: post?.longitude ?? 0 }"
      @confirm="handleMapConfirm"
    />
  </div>
</template>

<style scoped lang="scss">
.loading-state {
  padding: 40px;
  text-align: center;
  color: var(--fg-secondary-color);
}
.editor-page {
  background-color: var(--bg-primary-color);
  min-height: 100vh;
  padding-bottom: 40px;
}

.editor-topbar {
  background: rgba(var(--bg-primary-color-rgb), 0.95);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-secondary-color);
}

.page-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.editor-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
  padding-bottom: 24px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background: transparent;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.2rem;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }
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

.editor-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.meta-section,
.details-section {
  background-color: var(--bg-secondary-color);
  padding: 16px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
}

.cover-area {
  height: 180px;
  border-radius: var(--r-m);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-tertiary-color);
  position: relative;
  margin-bottom: 16px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
    .cover-overlay {
      opacity: 1;
    }
  }
}

.cover-preview {
  width: 100%;
  height: 100%;
  position: relative;

  :deep(.kit-image-container) {
    height: 100%;
  }
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.change-btn {
  background: white;
  color: black;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.cover-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
  span {
    font-weight: 600;
  }
}

.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--fg-tertiary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.details-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.main-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-group {
  :deep(.kit-input-wrapper) {
    > input {
      background: var(--bg-primary-color);
    }
  }

  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--fg-secondary-color);
  }

  &.dual {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}

.location-inputs {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.country-selector {
  flex: 1;
  min-width: 200px;
}

.option-flag {
  width: 20px;
  height: 15px;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.map-btn {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }
  &.has-coords {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background: rgba(var(--fg-accent-color-rgb), 0.1);
  }
}

.tags-input-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  min-height: 42px;

  &:focus-within {
    border-color: var(--fg-accent-color);
  }
}

.tag-chip {
  background: rgba(var(--fg-accent-color-rgb), 0.1);
  color: var(--fg-accent-color);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;

  .remove {
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 0.8;
    &:hover {
      opacity: 0.7;
    }
  }
}

.tag-input {
  border: none;
  background: transparent;
  outline: none;
  flex: 1;
  min-width: 80px;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
}

.add-stage-btn {
  width: 100%;
  justify-content: center;
  padding: 12px;
  margin-top: 16px;
}

@include media-down(sm) {
  .field-group.dual {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .location-inputs {
    flex-wrap: wrap;
  }
  .country-selector {
    width: 100%;
    flex: 100%;
    min-width: 100%;
  }
}
</style>
