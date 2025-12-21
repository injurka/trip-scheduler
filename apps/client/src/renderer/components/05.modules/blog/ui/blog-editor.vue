<script setup lang="ts">
import type { CreateBlogPostInput } from '~/shared/types/models/blog'
import { Icon } from '@iconify/vue'
import { v4 as uuidv4 } from 'uuid'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useBlogStore } from '../store/blog.store'
import BlogMediaManager from './blog-media-manager.vue'

type LocalBlogForm = Partial<CreateBlogPostInput> & { id?: string }

interface Props {
  isEditing?: boolean
  isLoading?: boolean
}

const props = defineProps<Props>()
defineEmits<{
  (e: 'save'): void
  (e: 'cancel'): void
}>()

const modelValue = defineModel<Partial<CreateBlogPostInput> & { id?: string }>({ required: true })

const store = useBlogStore()
const toast = useToast()

const localForm = ref<LocalBlogForm>({
  id: modelValue.value?.id || uuidv4(),
  title: modelValue.value?.title || '',
  slug: modelValue.value?.slug || '',
  content: modelValue.value?.content || '',
  excerpt: modelValue.value?.excerpt || '',
  coverImage: modelValue.value?.coverImage || '',
  published: modelValue.value?.published ?? true,
})

watch(
  () => localForm.value.id,
  (newId) => {
    if (newId && !props.isEditing) {
      store.fetchPostImages(newId)
    }
  },
  { immediate: true },
)

watch(
  () => modelValue.value,
  (newVal) => {
    if (!newVal)
      return

    const inputWithId = newVal as LocalBlogForm
    const incomingId = inputWithId.id || localForm.value.id

    if (localForm.value.title === '' || localForm.value.id !== incomingId) {
      localForm.value = {
        ...localForm.value,
        ...newVal,
        id: incomingId,
      }
    }
  },
  { deep: true },
)

watch(
  localForm,
  (newVal) => {
    const { id, ...rest } = newVal
    modelValue.value = { ...modelValue.value, ...rest }
  },
  { deep: true },
)

const viewMode = ref<'edit' | 'preview'>('edit')
const isMediaManagerOpen = ref(false)

const viewItems = [
  { id: 'edit', label: 'Редактор', icon: 'mdi:pencil' },
  { id: 'preview', label: 'Предпросмотр', icon: 'mdi:eye' },
]

function generateSlug() {
  if (!localForm.value.title)
    return
  const slug = localForm.value.title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!localForm.value.slug) {
    localForm.value.slug = slug
  }
}

function handleSetCover(url: string) {
  localForm.value.coverImage = url
  toast.success('Обложка установлена')
}

function handleInsertMarkdown(markdown: string) {
  localForm.value.content = `${localForm.value.content || ''}\n${markdown}`
  toast.success('Добавлено в конец текста')
}

function removeCover() {
  localForm.value.coverImage = ''
}
</script>

<template>
  <div class="blog-editor-layout">
    <div class="editor-toolbar">
      <div class="left-controls">
        <KitViewSwitcher v-model="viewMode" :items="viewItems" />
      </div>

      <div class="right-controls">
        <KitBtn
          variant="text"
          size="sm"
          :color="isMediaManagerOpen ? 'primary' : 'secondary'"
          @click="isMediaManagerOpen = !isMediaManagerOpen"
        >
          <Icon :icon="isMediaManagerOpen ? 'mdi:image-multiple' : 'mdi:image-multiple-outline'" />
          Медиатека
        </KitBtn>
      </div>
    </div>

    <Transition name="slide-fade">
      <div v-if="isMediaManagerOpen" class="media-panel-wrapper">
        <BlogMediaManager
          :post-id="localForm.id!"
          @set-cover="handleSetCover"
          @insert="handleInsertMarkdown"
        />
      </div>
    </Transition>

    <div v-show="viewMode === 'edit'" class="editor-container">
      <div class="meta-section">
        <div class="meta-inputs">
          <KitInput
            v-model="localForm.title"
            label="Заголовок"
            placeholder="Заголовок статьи"
            class="title-input"
            @blur="generateSlug"
          />
          <div class="slug-column">
            <KitInput
              v-model="localForm.slug"
              label="URL Slug"
              placeholder="url-slug"
            />
            <KitInput
              v-model="localForm.excerpt"
              label="Краткое описание"
              placeholder="Для карточки превью..."
            />
          </div>
        </div>

        <div class="cover-section">
          <div class="cover-label-row">
            <label>Обложка</label>
            <button v-if="localForm.coverImage" class="clear-cover-btn" @click="removeCover">
              Удалить
            </button>
          </div>

          <div
            class="cover-preview"
            :class="{ 'is-empty': !localForm.coverImage }"
            @click="!localForm.coverImage && (isMediaManagerOpen = true)"
          >
            <template v-if="localForm.coverImage">
              <KitImage :src="localForm.coverImage" object-fit="cover" />
            </template>
            <div v-else class="cover-placeholder">
              <Icon icon="mdi:image-plus-outline" />
              <span>Выбрать обложку</span>
            </div>
          </div>
        </div>
      </div>

      <KitDivider>Контент</KitDivider>

      <div class="content-section">
        <KitInlineMdEditorWrapper
          :key="localForm.id"
          v-model="localForm.content!"
          class="markdown-editor"
          placeholder="Напишите свою историю..."
          :features="{ 'block-edit': true, 'image-block': true, 'list-item': true, 'toolbar': true }"
        />
      </div>
    </div>

    <div v-show="viewMode === 'preview'" class="preview-container">
      <div class="preview-article">
        <h1 class="preview-title">
          {{ localForm.title || 'Заголовок статьи' }}
        </h1>

        <div v-if="localForm.coverImage" class="preview-cover">
          <KitImage :src="localForm.coverImage" object-fit="cover" />
        </div>

        <div class="preview-content-wrapper">
          <KitInlineMdEditorWrapper
            :model-value="localForm.content || ''"
            :readonly="true"
          />
        </div>
      </div>
    </div>

    <div class="editor-footer">
      <div class="footer-left">
        <KitCheckbox v-model="localForm.published">
          Опубликовать
        </KitCheckbox>
      </div>
      <div class="footer-right">
        <KitBtn variant="text" color="secondary" @click="$emit('cancel')">
          Отмена
        </KitBtn>
        <KitBtn :loading="isLoading" @click="$emit('save')">
          {{ isEditing ? 'Сохранить' : 'Создать' }}
        </KitBtn>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.blog-editor-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  background: transparent;
  border: none;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  background: transparent;
  border-bottom: 1px solid var(--border-secondary-color);
  flex-shrink: 0;
  min-height: 56px;
  margin-bottom: 16px;
}

.media-panel-wrapper {
  background: var(--bg-secondary-color);
  border-bottom: 1px solid var(--border-secondary-color);
  padding: 0;
  overflow: hidden;
  border-radius: var(--r-m);
  margin-bottom: 16px;
}

/* Editor Form Area */
.editor-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 32px 0;
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.meta-section {
  display: grid;
  /* Desktop: 2/3 контент, 1/3 картинка */
  grid-template-columns: 2fr 1fr;
  gap: 32px;
  align-items: start;

  @include media-down(md) {
    /* Mobile: 1 колонка, картинка упадет вниз (так как в DOM она идет второй) */
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

.meta-inputs {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.title-input {
  :deep(input) {
    font-size: 1.2rem;
    font-weight: 600;
  }
}

.slug-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cover-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cover-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  font-weight: 500;

  .clear-cover-btn {
    background: none;
    border: none;
    color: var(--fg-error-color);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
    opacity: 0.8;

    &:hover {
      opacity: 1;
      text-decoration: underline;
    }
  }
}

.cover-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--bg-tertiary-color);
  border-radius: var(--r-m);
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  transition: all 0.2s ease;

  &.is-empty {
    border: 1px dashed var(--border-secondary-color);
    cursor: pointer;

    &:hover {
      border-color: var(--border-primary-color);
      background: var(--bg-hover-color);
    }
  }
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg-tertiary-color);
  gap: 8px;

  .iconify {
    font-size: 2rem;
    opacity: 0.5;
  }
  span {
    font-size: 0.85rem;
  }
}

.content-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.markdown-editor {
  min-height: 400px;
  border: none;
  background: transparent;
  padding: 0;

  :deep(.cm-editor) {
    background: transparent;
  }
}

/* Preview Area */
.preview-container {
  flex: 1;
  overflow-y: auto;
  background: transparent;
  padding: 40px 0;
}

.preview-article {
  max-width: 800px;
  margin: 0 auto;
}

.preview-title {
  font-size: 2.5rem;
  line-height: 1.2;
  margin-bottom: 24px;
  color: var(--fg-primary-color);
}

.preview-cover {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--r-l);
  overflow: hidden;
  margin-bottom: 32px;
}

.preview-content-wrapper {
  font-size: 1.1rem;
  line-height: 1.7;
}

/* Footer */
.editor-footer {
  padding: 12px 0;
  background: transparent;
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.footer-right {
  display: flex;
  gap: 12px;
}

/* Transitions */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  opacity: 1;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
