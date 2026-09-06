<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { CreateBlogPostInput } from '~/shared/types/models/blog'
import { Icon } from '@iconify/vue'
import { getLocalTimeZone, parseDate, Time, today } from '@internationalized/date'
import { useEventListener } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDrawer } from '~/components/01.kit/kit-drawer'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitTimeField } from '~/components/01.kit/kit-time-field'
import { KitTooltip } from '~/components/01.kit/kit-tooltip'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { CalendarPopover } from '~/components/02.shared/calendar-popover'
import { useToast } from '~/shared/composables/use-toast'
import { formatDate } from '~/shared/lib/date-time'
import { slugify } from '~/shared/lib/slug'
import { useBlogStore } from '../store/blog.store'
import BlogMediaManager from './blog-media-manager.vue'

type LocalBlogForm = Partial<CreateBlogPostInput> & {
  id?: string
  publishedAt?: string | null
}

interface Props {
  isEditing?: boolean
  isLoading?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'save'): void
  (e: 'cancel'): void
}>()

const modelValue = defineModel<Partial<CreateBlogPostInput> & { id?: string }>({ required: true })

const store = useBlogStore()
const toast = useToast()

const isSlugManuallyEdited = ref(false)
const isSettingsDrawerOpen = ref(false)
const isMediaDrawerOpen = ref(false)
const viewMode = ref<'edit' | 'preview'>('edit')

const viewItems = [
  { id: 'edit', label: 'Редактор', icon: 'mdi:pencil-outline' },
  { id: 'preview', label: 'Предпросмотр', icon: 'mdi:eye-outline' },
]

const localForm = ref<LocalBlogForm>({
  id: modelValue.value?.id || uuidv4(),
  title: modelValue.value?.title || '',
  slug: modelValue.value?.slug || '',
  content: modelValue.value?.content || '',
  excerpt: modelValue.value?.excerpt || '',
  coverImage: modelValue.value?.coverImage || '',
  published: modelValue.value?.published ?? true,
  publishedAt: (modelValue.value as any)?.publishedAt || new Date().toISOString(),
})

// Initialize manual edit flag if slug was already provided
if (modelValue.value?.slug) {
  isSlugManuallyEdited.value = true
}

const selectedDate = shallowRef<CalendarDate>(today(getLocalTimeZone()))
const selectedTime = shallowRef<Time>(new Time(new Date().getHours(), new Date().getMinutes()))
const isInternalDateUpdate = ref(false)

// Handle keyboard shortcut (Ctrl+S / Cmd+S)
useEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    emit('save')
  }
})

watch(() => localForm.value.publishedAt, (newVal) => {
  if (isInternalDateUpdate.value)
    return

  if (newVal) {
    try {
      const dateObj = new Date(newVal)
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, '0')
      const day = String(dateObj.getDate()).padStart(2, '0')

      selectedDate.value = parseDate(`${year}-${month}-${day}`)
      selectedTime.value = new Time(dateObj.getHours(), dateObj.getMinutes())
    }
    catch (e) {
      console.error('Invalid date', e)
    }
  }
}, { immediate: true })

watch([selectedDate, selectedTime], ([date, time]) => {
  if (date && time) {
    const localDate = new Date(
      date.year,
      date.month - 1,
      date.day,
      time.hour,
      time.minute,
      0,
    )
    const newIso = localDate.toISOString()

    if (localForm.value.publishedAt !== newIso) {
      isInternalDateUpdate.value = true
      localForm.value.publishedAt = newIso
      nextTick(() => {
        isInternalDateUpdate.value = false
      })
    }
  }
})

const formattedPublishDate = computed(() => {
  if (!localForm.value.publishedAt)
    return 'Не выбрана'
  return formatDate(localForm.value.publishedAt, { dateStyle: 'long', timeStyle: 'short' })
})

// Auto-sync images for post ID
watch(
  () => localForm.value.id,
  (newId) => {
    if (newId && !props.isEditing)
      store.fetchPostImages(newId)
  },
  { immediate: true },
)

// Sync modelValue from external changes
watch(
  () => modelValue.value,
  (newVal) => {
    if (!newVal)
      return

    const inputWithId = newVal as LocalBlogForm
    const incomingId = inputWithId.id || localForm.value.id

    if (localForm.value.id !== incomingId || !localForm.value.title) {
      localForm.value = {
        ...localForm.value,
        ...newVal,
        id: incomingId,
        publishedAt: (newVal as any)?.publishedAt || new Date().toISOString(),
      }
      if (newVal.slug) {
        isSlugManuallyEdited.value = true
      }
    }
  },
  { deep: true, immediate: true },
)

// Sync back to modelValue
watch(
  localForm,
  (newVal) => {
    Object.assign(modelValue.value, newVal)
  },
  { deep: true },
)

// Auto-generate slug when title changes unless manually edited
function handleTitleInput() {
  if (!isSlugManuallyEdited.value && localForm.value.title) {
    localForm.value.slug = slugify(localForm.value.title)
  }
}

function handleSlugManualChange() {
  if (localForm.value.slug) {
    isSlugManuallyEdited.value = true
  }
  else {
    isSlugManuallyEdited.value = false
    if (localForm.value.title) {
      localForm.value.slug = slugify(localForm.value.title)
    }
  }
}

function regenerateSlug() {
  if (localForm.value.title) {
    localForm.value.slug = slugify(localForm.value.title)
    isSlugManuallyEdited.value = false
    toast.info('Slug обновлен из заголовка')
  }
}

function handleSetCover(url: string) {
  localForm.value.coverImage = url
  toast.success('Обложка установлена')
}

function handleInsertMarkdown(markdown: string) {
  localForm.value.content = `${localForm.value.content || ''}\n\n${markdown}\n`
  toast.success('Изображение добавлено в текст')
}

function removeCover() {
  localForm.value.coverImage = ''
  toast.info('Обложка удалена')
}

// Text stats calculation
const contentStats = computed(() => {
  const content = localForm.value.content || ''
  const cleanText = content.replace(/[#*`_~[\]()!-]/g, ' ').trim()
  const words = cleanText ? cleanText.split(/\s+/).length : 0
  const chars = content.length
  const readingTimeMin = Math.max(1, Math.ceil(words / 180))

  return {
    words,
    chars,
    readingTimeMin,
  }
})
</script>

<template>
  <div class="blog-editor-layout">
    <!-- Saving/Publishing Fullscreen Loader -->
    <div v-if="isLoading" class="fullscreen-loader-overlay">
      <div class="overlay-bg" />
      <div class="overlay-content">
        <Icon icon="mdi:loading" class="spinner" />
        <span>{{ isEditing ? 'Сохранение изменений...' : 'Публикация статьи...' }}</span>
      </div>
    </div>

    <!-- Top Sticky Toolbar -->
    <header class="editor-header-bar">
      <div class="header-left">
        <KitBtn
          variant="outlined"
          color="secondary"
          size="sm"
          class="back-btn"
          @click="$emit('cancel')"
        >
          <Icon icon="mdi:arrow-left" />
          <span class="back-label">Назад</span>
        </KitBtn>

        <div class="divider-vertical" />

        <div class="status-pill" :class="{ 'is-published': localForm.published }">
          <span class="status-dot" />
          <span class="status-text">{{ localForm.published ? 'Опубликовано' : 'Черновик' }}</span>
        </div>

        <div class="stats-preview" :title="`${contentStats.chars} символов, ${contentStats.words} слов`">
          <Icon icon="mdi:clock-outline" />
          <span>~{{ contentStats.readingTimeMin }} мин</span>
          <span class="stats-sep">·</span>
          <span>{{ contentStats.words }} сл.</span>
        </div>
      </div>

      <div class="header-center">
        <KitViewSwitcher v-model="viewMode" :items="viewItems" />
      </div>

      <div class="header-right">
        <KitTooltip text="Медиатека статьи">
          <KitBtn
            variant="tonal"
            size="sm"
            :color="isMediaDrawerOpen ? 'primary' : 'secondary'"
            @click="isMediaDrawerOpen = true"
          >
            <Icon icon="mdi:image-multiple-outline" />
            <span class="btn-label">Медиа</span>
            <span v-if="store.postImages.length > 0" class="btn-counter">{{ store.postImages.length }}</span>
          </KitBtn>
        </KitTooltip>

        <KitTooltip text="Параметры и SEO">
          <KitBtn
            variant="tonal"
            size="sm"
            :color="isSettingsDrawerOpen ? 'primary' : 'secondary'"
            @click="isSettingsDrawerOpen = true"
          >
            <Icon icon="mdi:cog-outline" />
            <span class="btn-label">Параметры</span>
          </KitBtn>
        </KitTooltip>

        <KitBtn
          :loading="isLoading"
          size="sm"
          class="primary-save-btn"
          @click="$emit('save')"
        >
          <Icon :icon="isEditing ? 'mdi:content-save-outline' : 'mdi:send-outline'" />
          <span>{{ isEditing ? 'Сохранить' : 'Опубликовать' }}</span>
        </KitBtn>
      </div>
    </header>

    <!-- Main Workspace Content -->
    <main class="editor-workspace">
      <!-- Edit Mode Canvas -->
      <div v-show="viewMode === 'edit'" class="canvas-container">
        <!-- Cover Banner Section -->
        <div class="cover-hero-wrapper">
          <div v-if="localForm.coverImage" class="cover-banner">
            <KitImage :src="localForm.coverImage" object-fit="cover" class="cover-img" />
            <div class="cover-overlay-actions">
              <KitBtn
                variant="tonal"
                size="sm"
                class="cover-action-btn"
                @click="isMediaDrawerOpen = true"
              >
                <Icon icon="mdi:image-edit-outline" />
                Сменить обложку
              </KitBtn>
              <KitBtn
                variant="tonal"
                size="sm"
                class="cover-action-btn danger"
                @click="removeCover"
              >
                <Icon icon="mdi:trash-can-outline" />
                Удалить
              </KitBtn>
            </div>
          </div>

          <div v-else class="cover-empty-trigger" @click="isMediaDrawerOpen = true">
            <Icon icon="mdi:image-plus-outline" />
            <span>Добавить обложку статьи</span>
          </div>
        </div>

        <!-- Title & Excerpt Section -->
        <div class="document-header">
          <input
            v-model="localForm.title"
            type="text"
            class="title-ghost-input"
            placeholder="Заголовок статьи..."
            @input="handleTitleInput"
          >

          <input
            v-model="localForm.excerpt"
            type="text"
            class="excerpt-ghost-input"
            placeholder="Краткое описание (подзаголовок)..."
          >
        </div>

        <!-- Markdown Canvas -->
        <div class="document-body">
          <KitInlineMdEditorWrapper
            :key="localForm.id"
            v-model="localForm.content!"
            class="article-markdown-editor"
            placeholder="Начните писать историю, заметку или путеводитель..."
            :features="{ 'block-edit': true, 'image-block': true, 'list-item': true, 'toolbar': true }"
          />
        </div>
      </div>

      <!-- Live Preview Mode Canvas -->
      <div v-show="viewMode === 'preview'" class="preview-mode-wrapper">
        <article class="article-preview-card">
          <header class="preview-article-header">
            <div class="preview-meta-row">
              <span class="preview-date-badge">{{ formattedPublishDate }}</span>
              <span class="preview-dot">·</span>
              <span class="preview-stats-badge">~{{ contentStats.readingTimeMin }} мин чтения</span>
            </div>
            <h1 class="preview-article-title">
              {{ localForm.title || 'Заголовок статьи' }}
            </h1>
            <p v-if="localForm.excerpt" class="preview-article-excerpt">
              {{ localForm.excerpt }}
            </p>
          </header>

          <div v-if="localForm.coverImage" class="preview-hero-cover">
            <KitImage :src="localForm.coverImage" :alt="localForm.title" object-fit="cover" />
          </div>

          <div class="preview-article-content">
            <KitInlineMdEditorWrapper
              :model-value="localForm.content || ''"
              :readonly="true"
            />
          </div>
        </article>
      </div>
    </main>

    <!-- Settings & SEO Drawer -->
    <KitDrawer v-model:open="isSettingsDrawerOpen" side="right" width="420px">
      <div class="settings-drawer-panel">
        <div class="drawer-header">
          <div class="drawer-title-group">
            <Icon icon="mdi:tune-variant" class="drawer-icon" />
            <h3 class="drawer-title">
              Параметры статьи
            </h3>
          </div>
        </div>

        <div class="drawer-body">
          <!-- Publication Settings -->
          <div class="settings-group">
            <label class="group-title">Публикация</label>
            <div class="setting-card">
              <div class="setting-row">
                <KitCheckbox v-model="localForm.published">
                  Опубликовать статью
                </KitCheckbox>
              </div>
              <p class="setting-hint">
                {{ localForm.published ? 'Статья доступна читателям в блоге' : 'Черновик доступен только администраторам' }}
              </p>
            </div>

            <div class="setting-card">
              <label class="setting-label">Дата и время публикации</label>
              <div class="date-picker-row">
                <CalendarPopover v-model="selectedDate">
                  <template #trigger>
                    <KitBtn variant="outlined" color="secondary" icon="mdi:calendar" size="sm" class="date-btn">
                      {{ formattedPublishDate }}
                    </KitBtn>
                  </template>
                </CalendarPopover>
                <KitTimeField v-model="selectedTime" class="time-field" />
              </div>
            </div>
          </div>

          <!-- URL Slug & SEO -->
          <div class="settings-group">
            <label class="group-title">URL и SEO</label>
            <div class="setting-card">
              <div class="slug-field-header">
                <label class="setting-label">ЧПУ Slug (URL адрес)</label>
                <button class="regenerate-slug-btn" title="Сгенерировать из заголовка" @click="regenerateSlug">
                  <Icon icon="mdi:auto-fix" />
                  <span>Авто</span>
                </button>
              </div>

              <KitInput
                v-model="localForm.slug"
                placeholder="url-slug"
                @input="handleSlugManualChange"
              />

              <div class="url-preview">
                <span class="url-prefix">/blog/</span>
                <span class="url-value">{{ localForm.slug || 'slug-stati' }}</span>
              </div>
            </div>

            <div class="setting-card">
              <div class="excerpt-field-header">
                <label class="setting-label">Краткое описание (Snippet)</label>
                <span class="char-count">{{ (localForm.excerpt || '').length }} симв.</span>
              </div>
              <KitInput
                v-model="localForm.excerpt"
                placeholder="Краткое описание для карточки и поисковых систем..."
              />
            </div>
          </div>

          <!-- Cover Image Settings -->
          <div class="settings-group">
            <label class="group-title">Обложка статьи</label>
            <div class="setting-card">
              <div v-if="localForm.coverImage" class="drawer-cover-preview">
                <KitImage :src="localForm.coverImage" object-fit="cover" />
                <div class="cover-quick-actions">
                  <KitBtn variant="tonal" size="sm" @click="isMediaDrawerOpen = true">
                    Сменить
                  </KitBtn>
                  <KitBtn variant="tonal" size="sm" class="cover-delete-btn" @click="removeCover">
                    Удалить
                  </KitBtn>
                </div>
              </div>
              <div v-else class="drawer-no-cover" @click="isMediaDrawerOpen = true">
                <Icon icon="mdi:image-plus-outline" />
                <span>Выбрать обложку в медиатеке</span>
              </div>
            </div>
          </div>

          <!-- Article Stats -->
          <div class="settings-group">
            <label class="group-title">Статистика документа</label>
            <div class="stats-grid">
              <div class="stat-box">
                <span class="stat-number">{{ contentStats.words }}</span>
                <span class="stat-label">Слов</span>
              </div>
              <div class="stat-box">
                <span class="stat-number">{{ contentStats.chars }}</span>
                <span class="stat-label">Символов</span>
              </div>
              <div class="stat-box">
                <span class="stat-number">~{{ contentStats.readingTimeMin }} мин</span>
                <span class="stat-label">Время чтения</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </KitDrawer>

    <!-- Media Library Drawer -->
    <KitDrawer v-model:open="isMediaDrawerOpen" side="right" width="460px">
      <div class="media-drawer-panel">
        <div class="drawer-header">
          <div class="drawer-title-group">
            <Icon icon="mdi:image-multiple-outline" class="drawer-icon" />
            <h3 class="drawer-title">
              Медиатека статьи
            </h3>
          </div>
        </div>

        <div class="drawer-body">
          <BlogMediaManager
            :post-id="localForm.id!"
            :current-cover-url="localForm.coverImage || ''"
            @set-cover="handleSetCover"
            @insert="handleInsertMarkdown"
          />
        </div>
      </div>
    </KitDrawer>
  </div>
</template>

<style scoped lang="scss">
.blog-editor-layout {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--header-height, 64px));
  width: 100%;
  background: transparent;
  position: relative;
}

.fullscreen-loader-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;

  .overlay-bg {
    position: absolute;
    inset: 0;
    background: var(--bg-primary-color);
    opacity: 0.85;
    backdrop-filter: blur(4px);
  }

  .overlay-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--fg-primary-color);
    font-weight: 500;
    font-size: 1.1rem;

    .spinner {
      font-size: 3rem;
      color: var(--fg-accent-color);
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Top Sticky Header Toolbar */
.editor-header-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: var(--bg-primary-color);
  border-bottom: 1px solid var(--border-secondary-color);
  backdrop-filter: blur(8px);
  gap: 16px;

  @include media-down(md) {
    padding: 8px 12px;
    flex-wrap: wrap;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.back-btn {
  border-color: transparent !important;
  opacity: 0.8;

  &:hover {
    opacity: 1;
  }

  .back-label {
    @include media-down(sm) {
      display: none;
    }
  }
}

.divider-vertical {
  width: 1px;
  height: 20px;
  background: var(--border-secondary-color);

  @include media-down(sm) {
    display: none;
  }
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--r-full);
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--fg-secondary-color);

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fg-tertiary-color);
  }

  &.is-published {
    border-color: rgba(var(--fg-success-color-rgb, 103, 209, 116), 0.3);
    background: rgba(var(--fg-success-color-rgb, 103, 209, 116), 0.1);
    color: var(--fg-success-color, #67d174);

    .status-dot {
      background: var(--fg-success-color, #67d174);
    }
  }
}

.stats-preview {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);

  @include media-down(md) {
    display: none;
  }

  .stats-sep {
    opacity: 0.5;
  }
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;

  .btn-label {
    @include media-down(sm) {
      display: none;
    }
  }

  .btn-counter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 6px;
    border-radius: var(--r-full);
    background: var(--bg-tertiary-color);
    font-size: 0.7rem;
    font-weight: 600;
  }

  .primary-save-btn {
    font-weight: 500;
    gap: 6px;
  }
}

/* Main Workspace */
.editor-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.canvas-container {
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @include media-down(sm) {
    padding: 20px 16px 60px;
    gap: 16px;
  }
}

/* Cover Banner Hero */
.cover-hero-wrapper {
  width: 100%;
}

.cover-banner {
  position: relative;
  width: 100%;
  height: 320px;
  border-radius: var(--r-l);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);

  @include media-down(sm) {
    height: 200px;
  }

  .cover-img {
    width: 100%;
    height: 100%;
    display: block;
  }

  &:hover .cover-overlay-actions {
    opacity: 1;
  }
}

.cover-overlay-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  padding: 6px;
  border-radius: var(--r-m);

  .cover-action-btn {
    backdrop-filter: blur(4px);

    &.danger:hover {
      color: var(--fg-error-color);
    }
  }
}

.cover-empty-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--r-m);
  border: 1px dashed var(--border-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: fit-content;

  &:hover {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    background: var(--bg-secondary-color);
  }

  .iconify {
    font-size: 1.2rem;
  }
}

/* Document Header (Ghost Inputs) */
.document-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 8px;
}

.title-ghost-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 2.35rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--fg-primary-color);
  outline: none;
  padding: 0;
  font-family: inherit;

  &::placeholder {
    color: var(--fg-tertiary-color);
    opacity: 0.6;
  }

  @include media-down(sm) {
    font-size: 1.75rem;
  }
}

.excerpt-ghost-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 1.1rem;
  line-height: 1.5;
  color: var(--fg-secondary-color);
  outline: none;
  padding: 0;
  font-family: inherit;

  &::placeholder {
    color: var(--fg-tertiary-color);
    opacity: 0.5;
    font-style: italic;
  }
}

/* Document Markdown Body */
.document-body {
  width: 100%;
  min-height: 450px;
}

.article-markdown-editor {
  min-height: 450px;
  border: none;
  background: transparent;
  padding: 0;

  :deep(.cm-editor) {
    background: transparent;
  }
}

/* Live Preview Mode */
.preview-mode-wrapper {
  max-width: 840px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 24px 80px;

  @include media-down(sm) {
    padding: 24px 16px 60px;
  }
}

.article-preview-card {
  width: 100%;
}

.preview-article-header {
  margin-bottom: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--fg-accent-color);
  font-weight: 500;
}

.preview-dot {
  opacity: 0.6;
}

.preview-article-title {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--fg-primary-color);
  margin: 0;

  @include media-down(sm) {
    font-size: 1.85rem;
  }
}

.preview-article-excerpt {
  font-size: 1.15rem;
  line-height: 1.6;
  color: var(--fg-secondary-color);
  margin: 0;
  font-style: italic;
}

.preview-hero-cover {
  width: 100%;
  height: 380px;
  border-radius: var(--r-l);
  overflow: hidden;
  margin-bottom: 36px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

  @include media-down(sm) {
    height: 220px;
  }
}

.preview-article-content {
  font-size: 1.05rem;
  line-height: 1.7;
}

/* Drawers Shared Styling */
.settings-drawer-panel,
.media-drawer-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-secondary-color);
  margin-bottom: 20px;
  flex-shrink: 0;
}

.drawer-title-group {
  display: flex;
  align-items: center;
  gap: 10px;

  .drawer-icon {
    font-size: 1.3rem;
    color: var(--fg-accent-color);
  }

  .drawer-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    color: var(--fg-primary-color);
  }
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-secondary-color);
    border-radius: 4px;
  }
}

/* Settings Group */
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-tertiary-color);
}

.setting-card {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.setting-hint {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
  margin: 0;
  line-height: 1.4;
}

.date-picker-row {
  display: flex;
  gap: 8px;
  align-items: center;

  .date-btn {
    flex: 1;
    justify-content: flex-start;
  }

  .time-field {
    width: 110px;
    flex-shrink: 0;
  }
}

.slug-field-header,
.excerpt-field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.regenerate-slug-btn {
  background: none;
  border: none;
  color: var(--fg-accent-color);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--r-xs);

  &:hover {
    background: var(--bg-tertiary-color);
  }
}

.url-preview {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  padding: 6px 10px;
  background: var(--bg-tertiary-color);
  border-radius: var(--r-s);
  overflow-x: auto;
  color: var(--fg-tertiary-color);

  .url-value {
    color: var(--fg-accent-color);
    font-weight: 500;
  }
}

.char-count {
  font-size: 0.75rem;
  color: var(--fg-tertiary-color);
}

.drawer-cover-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--r-s);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);

  img {
    width: 100%;
    height: 100%;
    display: block;
  }

  .cover-quick-actions {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    gap: 6px;

    .cover-delete-btn:hover {
      color: var(--fg-error-color);
    }
  }
}

.drawer-no-cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;

  .iconify {
    font-size: 1.8rem;
    opacity: 0.6;
  }

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    background: var(--bg-hover-color);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-box {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;

  .stat-number {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--fg-tertiary-color);
  }
}
</style>
