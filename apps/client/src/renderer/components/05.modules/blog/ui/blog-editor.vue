<script setup lang="ts">
import type { CreateBlogPostInput } from '~/shared/types/models/blog'
import { Icon } from '@iconify/vue'
import { useVModel } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitCheckbox } from '~/components/01.kit/kit-checkbox'
import { KitFileInput } from '~/components/01.kit/kit-file-input'
import { KitImage } from '~/components/01.kit/kit-image'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { KitInput } from '~/components/01.kit/kit-input'
import { useBlogStore } from '../store/blog.store'

interface Props {
  modelValue: Partial<CreateBlogPostInput>
  isEditing?: boolean
  isLoading?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const form = useVModel(props, 'modelValue', emit)
const store = useBlogStore()
const toast = useToast()

// Автогенерация слага из заголовка
function generateSlug() {
  if (!form.value.title)
    return
  const slug = form.value.title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!form.value.slug) {
    form.value.slug = slug
  }
}

async function handleImageUpload(file: File | null) {
  if (!file)
    return

  try {
    await store.uploadImage(file)
    toast.success('Обложка загружена')
  }
  catch {
    toast.error('Не удалось загрузить изображение')
  }
}
</script>

<template>
  <div class="blog-editor">
    <div class="editor-header">
      <KitInput
        v-model="form.title"
        label="Заголовок"
        placeholder="Введите заголовок статьи"
        @blur="generateSlug"
      />
      <KitInput
        v-model="form.slug"
        label="Slug (URL)"
        placeholder="url-stati"
      />
    </div>

    <div class="editor-meta">
      <div class="cover-upload">
        <label>Обложка</label>
        <div v-if="form.coverImage" class="current-cover">
          <KitImage :src="form.coverImage" height="200px" object-fit="cover" />
          <button class="remove-cover" @click="form.coverImage = ''">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <KitFileInput
          v-else
          :model-value="null"
          :loading="store.isUploading"
          @update:model-value="handleImageUpload"
        >
          {{ store.isUploading ? 'Загрузка...' : 'Загрузить обложку' }}
        </KitFileInput>
      </div>

      <KitInput
        v-model="form.excerpt"
        type="textarea"
        label="Краткое описание"
        placeholder="Текст для превью в списке..."
        :rows="3"
      />

      <KitCheckbox v-model="form.published">
        Опубликовать
      </KitCheckbox>
    </div>

    <div class="content-editor-wrapper">
      <label>Содержание</label>
      <KitInlineMdEditorWrapper
        v-model="form.content!"
        class="markdown-editor"
        placeholder="Напишите что-нибудь интересное..."
        :features="{ 'block-edit': true, 'image-block': true, 'list-item': true, 'toolbar': true }"
      />
    </div>

    <div class="editor-actions">
      <KitBtn variant="outlined" color="secondary" @click="$emit('cancel')">
        Отмена
      </KitBtn>
      <KitBtn :loading="isLoading" @click="$emit('save')">
        {{ isEditing ? 'Сохранить изменения' : 'Создать статью' }}
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.blog-editor {
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: var(--r-l);
  border: 1px solid var(--border-secondary-color);
}

.editor-header {
  display: grid;
  gap: 16px;
  grid-template-columns: 2fr 1fr;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.editor-meta {
  display: flex;
  flex-direction: column;
  gap: 16px;

  label {
    font-weight: 500;
    color: var(--fg-secondary-color);
    font-size: 0.9rem;
    margin-bottom: 4px;
    display: block;
  }
}

.current-cover {
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;

  .remove-cover {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(200, 50, 50, 0.8);
    }
  }
}

.content-editor-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 400px;

  label {
    font-weight: 500;
    color: var(--fg-secondary-color);
    font-size: 0.9rem;
  }
}

.markdown-editor {
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  min-height: 400px;
  background: var(--bg-primary-color);
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border-secondary-color);
  padding-top: 16px;
}
</style>
