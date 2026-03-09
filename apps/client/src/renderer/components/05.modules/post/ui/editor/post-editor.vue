<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { parseDate } from '@internationalized/date'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCalendar } from '~/components/01.kit/kit-calendar'
import { KitDropdown } from '~/components/01.kit/kit-dropdown'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitSelectWithSearch } from '~/components/01.kit/kit-select-with-search'
import { NavigationBack } from '~/components/02.shared/navigation-back'
import { useRequest } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { MOCK_COUNTRY_DATA } from '../../data/countries'
import { usePostDraftStore } from '../../store/post-draft.store'
import { EPostRequestKeys, usePostStore } from '../../store/post.store'
import PostDetailsView from '../details/post-details-view.vue'
import StageEditor from './stage-editor.vue'
import MediaLibraryPicker from './tools/media-library-picker.vue'
import PostMapPicker from './tools/post-map-picker.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm() 
const draftStore = usePostDraftStore()
const postStore = usePostStore()

const { post } = storeToRefs(draftStore)
const isGenerating = computed(() => postStore.isGenerating)
const isPreviewMode = ref(false)
const isPublishing = ref(false)
const isEditMode = ref(false)
const isLoading = ref(true)

const aiPrompt = ref('')

const isMediaLibraryOpen = ref(false)
const isMapPickerOpen = ref(false)

const durationType = ref<'hours' | 'days'>('hours')
const durationValue = ref<number | null>(null)

const tempTag = ref('')
const suggestedTags = ref<string[]>([])
const tagsWrapperRef = ref<HTMLElement | null>(null)
const isTagInputFocused = ref(false)

const calendarDateModel = computed({
  get: () => {
    if (!post.value?.startDate)
      return null
    try { return parseDate(post.value.startDate) }
    catch { return null }
  },
  set: (val) => {
    if (post.value)
      post.value.startDate = val ? val.toString() : ''
  },
})

const formattedStartDate = computed(() => {
  if (!post.value?.startDate)
    return ''
  const d = new Date(post.value.startDate)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
})

function openLibraryManage() { isMediaLibraryOpen.value = true }
function handleMapConfirm(coords: { lat: number, lng: number }) {
  if (post.value) { post.value.latitude = coords.lat; post.value.longitude = coords.lng }
}

async function fetchTags(query: string) {
  await useRequest<string[]>({
    key: EPostRequestKeys.UNIQUE_TAGS,
    fn: db => db.posts.getUniqueTags({ query }),
    onSuccess: (res) => { suggestedTags.value = res || [] },
  })
}

watch(tempTag, (val) => {
  if (val && isTagInputFocused.value)
    fetchTags(val)
  else suggestedTags.value = []
})

onClickOutside(tagsWrapperRef, () => { isTagInputFocused.value = false })

function addTag(val?: string) {
  const tagToAdd = (val || tempTag.value).trim().toLowerCase()
  if (tagToAdd && post.value) {
    if (post.value.tags.includes(tagToAdd))
      toast.warn(`Тег "${tagToAdd}" уже добавлен`)
    else draftStore.addTag(tagToAdd)
    tempTag.value = ''; suggestedTags.value = []
  }
}

watch(() => post.value?.statsDetail?.duration, (val) => {
  if (val && !durationValue.value) {
    if (val >= 24 && val % 24 === 0) { durationType.value = 'days'; durationValue.value = val / 24 }
    else { durationType.value = 'hours'; durationValue.value = val }
  }
}, { immediate: true })

function updateDuration() {
  nextTick(() => {
    if (!post.value)
      return
    if (!durationValue.value)
      post.value.statsDetail.duration = 0
    else post.value.statsDetail.duration = durationType.value === 'days' ? durationValue.value * 24 : durationValue.value
  })
}

const countryOptions = computed(() => MOCK_COUNTRY_DATA.map(c => ({ value: c.name.rus, label: c.name.rus, flag: c.flag })))

async function handleGenerate() {
  if (!aiPrompt.value.trim() || aiPrompt.value.length < 10) {
    toast.warn('Опишите ваше путешествие подробнее (минимум 10 символов)')
    return
  }

  const isConfirmed = await confirm({
    title: 'Сгенерировать пост?',
    description: 'Внимание: все текущие заполненные поля (заголовок, описание, теги) и таймлайны будут сброшены и заменены результатом генерации ИИ. Вы уверены?',
    confirmText: 'Да, сгенерировать',
  })

  if (!isConfirmed)
    return

  await draftStore.generateWithAi(aiPrompt.value)
  aiPrompt.value = ''
}

async function handlePublish() {
  if (!post.value)
    return
  if (!post.value.title) { toast.error('Пожалуйста, укажите заголовок'); return }
  if (!post.value.country) { toast.error('Пожалуйста, выберите страну'); return }

  isPublishing.value = true
  try {
    const postId = await draftStore.savePost(!isEditMode.value, 'completed')
    toast.success(isEditMode.value ? 'Пост обновлен!' : 'Пост успешно опубликован!')
    if (postId)
      router.push(AppRoutePaths.Post.Details(postId))
  }
  catch (e) { console.error(e); toast.error('Ошибка при сохранении поста') }
  finally { isPublishing.value = false }
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
    else { toast.error('Пост для редактирования не найден'); router.replace(AppRoutePaths.Post.List) }
  }
  else { isEditMode.value = false; draftStore.initDraft() }
  isLoading.value = false
}

onMounted(() => loadPostForEditor())
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
      <PostDetailsView :post="previewData" :is-preview-mode="true" />
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
          <KitInput v-model="post.description" label="Вступление" placeholder="О чем это путешествие..." type="textarea" :rows="3" />
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
                  :model-value="post.country ?? null"
                  :items="countryOptions"
                  placeholder="Страна"
                  size="sm"
                  @update:model-value="val => { if (post) post.country = val as string }"
                >
                  <template #item="{ item }">
                    <img v-if="(item as any).flag" :src="(item as any).flag" class="option-flag" alt="">
                    <span>{{ item.label }}</span>
                  </template>
                </KitSelectWithSearch>
              </div>

              <button class="map-btn" :class="{ 'has-coords': post.latitude }" title="Указать на карте" @click="isMapPickerOpen = true">
                <Icon icon="mdi:map-marker-radius" />
              </button>
            </div>
          </div>

          <div class="field-group dual">
            <div>
              <label>Дата начала</label>
              <KitDropdown align="start" :side-offset="4">
                <template #trigger>
                  <div class="date-trigger-wrapper" :class="{ 'is-empty': !post.startDate }">
                    <Icon icon="mdi:calendar" class="input-icon-prefix" />
                    <div class="trigger-text">
                      {{ formattedStartDate || 'Выберите дату...' }}
                    </div>
                  </div>
                </template>
                <div class="calendar-dropdown-content">
                  <KitCalendar v-model="calendarDateModel" />
                </div>
              </KitDropdown>
            </div>
            <div>
              <label>Время в пути</label>
              <div class="duration-editor">
                <KitInput v-model.number="durationValue" type="number" placeholder="0" size="sm" class="duration-val-input" @input="updateDuration" />
                <KitSelectWithSearch
                  v-model="durationType"
                  :items="[{ value: 'hours', label: 'Часов' }, { value: 'days', label: 'Дней' }]"
                  size="sm"
                  class="duration-type-select"
                  :clearable="false"
                  @update:model-value="updateDuration"
                />
              </div>
            </div>
          </div>

          <div class="field-group">
            <label>Теги (#прогулка, #архитектура)</label>
            <div ref="tagsWrapperRef" class="tags-input-container">
              <div class="tags-input-wrapper">
                <div v-for="tag in post.tags" :key="tag" class="tag-chip">
                  #{{ tag }} <span class="remove" @click="draftStore.removeTag(tag)">×</span>
                </div>
                <input v-model="tempTag" placeholder="+ Добавить" class="tag-input" @keydown.enter="addTag()" @focus="isTagInputFocused = true; fetchTags('')">
              </div>

              <div v-if="suggestedTags.length > 0 && isTagInputFocused" class="tags-dropdown">
                <div class="suggested-tags-wrapper">
                  <button v-for="tag in suggestedTags" :key="tag" class="suggested-tag-btn" @click.stop="addTag(tag)">
                    #{{ tag }}
                  </button>
                </div>
              </div>
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

        <KitBtn variant="tonal" icon="mdi:plus-circle-outline" class="add-stage-btn" @click="draftStore.addStage">
          Добавить этап
        </KitBtn>
      </section>

      <section v-if="!isEditMode && (!post.stages?.length || (post.stages.length === 1 && post.stages[0].blocks.length === 0))" class="ai-generation-section" :class="{ 'is-loading': isGenerating }">
        <div v-if="isGenerating" class="generating-overlay">
          <Icon icon="mdi:loading" class="spinner-icon" />
          <span>Магия в процессе...</span>
        </div>

        <div class="ai-header">
          <Icon icon="mdi:magic-staff" class="ai-icon" />
          <h3>Магия ИИ</h3>
        </div>
        <p class="ai-hint">
          Опишите ваше путешествие текстом, а мы автоматически соберем структуру, таймлайны и маршруты для поста.
        </p>
        <KitInput
          v-model="aiPrompt"
          type="textarea"
          :rows="4"
          :disabled="isGenerating"
          placeholder="Например: Вчера мы прилетели в Париж. Утром пошли к Эйфелевой башне, потом обедали в кафе Le Marly, а вечером гуляли по Монмартру..."
        />
        <KitBtn
          icon="mdi:creation"
          variant="subtle"
          color="primary"
          :loading="isGenerating"
          class="ai-btn"
          @click="handleGenerate"
        >
          Сгенерировать пост
        </KitBtn>
      </section>

      <div class="editor-submit">
        <KitBtn icon="mdi:check" :loading="isPublishing" variant="subtle" @click="handlePublish">
          {{ isEditMode ? 'Сохранить изменения' : 'Опубликовать' }}
        </KitBtn>
      </div>
    </div>

    <MediaLibraryPicker v-model:visible="isMediaLibraryOpen" mode="manage" @confirm="isMediaLibraryOpen = false" />
    <PostMapPicker v-model:visible="isMapPickerOpen" :initial-coords="{ lat: post?.latitude ?? 0, lng: post?.longitude ?? 0 }" @confirm="handleMapConfirm" />
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
  height: 36px;
  &:hover {
    background: var(--bg-hover-color);
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

.ai-generation-section {
  position: relative;
  background: linear-gradient(
    135deg,
    rgba(var(--bg-accent-color-rgb), 0.1) 0%,
    rgba(var(--bg-primary-color-rgb), 0.5) 100%
  );
  border: 1px solid var(--border-accent-color);
  border-radius: var(--r-m);
  padding: 20px;
  box-shadow: 0 4px 20px rgba(var(--bg-accent-color-rgb), 0.05);

  &.is-loading {
    overflow: hidden;
    pointer-events: none;
  }

  .ai-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    color: var(--fg-accent-color);
    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
    }
    .ai-icon {
      font-size: 1.5rem;
    }
  }

  .ai-hint {
    color: var(--fg-secondary-color);
    font-size: 0.9rem;
    margin-bottom: 16px;
    line-height: 1.4;
  }
  .ai-btn {
    margin-top: 16px;
    width: 100%;
    justify-content: center;
  }
}

.generating-overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--bg-primary-color-rgb), 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  color: var(--fg-accent-color);
  font-weight: 600;
  gap: 12px;

  .spinner-icon {
    font-size: 36px;
    animation: ai-spin 1.5s linear infinite;
  }
}

@keyframes ai-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
  :deep(.kit-input-wrapper) > input {
    background: var(--bg-primary-color);
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

.date-trigger-wrapper {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 0 12px;
  display: flex;
  align-items: center;
  cursor: pointer;
  min-height: 38px;
  transition: border-color 0.2s;
  &:hover {
    border-color: var(--border-focus-color);
  }
  .input-icon-prefix {
    color: var(--fg-tertiary-color);
    margin-right: 8px;
    font-size: 1.1rem;
  }
  .trigger-text {
    color: var(--fg-primary-color);
    font-size: 0.875rem;
    user-select: none;
  }
  &.is-empty .trigger-text {
    color: var(--fg-tertiary-color);
  }
}

.calendar-dropdown-content :deep(.calendar) {
  background-color: transparent;
  border: none;
  box-shadow: none;
  padding: 4px;
}
.duration-editor {
  display: flex;
  gap: 8px;
  align-items: stretch;
  .duration-val-input {
    width: 90px;
    flex-shrink: 0;
  }
  .duration-type-select {
    flex-grow: 1;
    min-width: 110px;
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
  :deep(.chip-input-wrapper) {
    background-color: var(--bg-primary-color) !important;
  }
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

.tags-input-container {
  position: relative;
}
.tags-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 8px;
  box-shadow: var(--s-l);
  z-index: 10;
}
.suggested-tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.suggested-tag-btn {
  background: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 4px 10px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: rgba(var(--fg-accent-color-rgb), 0.1);
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
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
  padding: 0px 8px;
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
