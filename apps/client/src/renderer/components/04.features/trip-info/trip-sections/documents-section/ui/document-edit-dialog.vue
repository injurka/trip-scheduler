<script setup lang="ts">
import type { DocumentCategory, DocumentFile, DocumentFolder } from '../models/types'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { DOCUMENT_CATEGORIES, getFileTypeInfo } from '../constants'

interface Props {
  visible: boolean
  document: DocumentFile | null
  folders: DocumentFolder[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', updatedDoc: DocumentFile): void
}>()

const localTitle = ref('')
const localCategory = ref<DocumentCategory | null>(null)
const localFolderId = ref<string | null>(null)
const localAccess = ref<'public' | 'private'>('private')
const localNote = ref('')
const localIsFavorite = ref(false)

watch(() => props.document, (doc) => {
  if (doc) {
    localTitle.value = doc.title || ''
    localCategory.value = doc.category || null
    localFolderId.value = doc.folderId || null
    localAccess.value = doc.access || 'private'
    localNote.value = doc.note || ''
    localIsFavorite.value = Boolean(doc.isFavorite)
  }
}, { immediate: true })

const fileExtension = computed(() => {
  if (!props.document)
    return ''
  return props.document.url.split('.').pop()?.toLowerCase().split('?')[0] || ''
})

const fileTypeInfo = computed(() => {
  return getFileTypeInfo(fileExtension.value)
})

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0)
    return '0 Байт'
  const k = 1024
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function handleSave() {
  if (!props.document)
    return

  const updated: DocumentFile = {
    ...props.document,
    title: localTitle.value.trim() ? localTitle.value.trim() : null,
    category: localCategory.value,
    folderId: localFolderId.value,
    access: localAccess.value,
    note: localNote.value.trim() ? localNote.value.trim() : null,
    isFavorite: localIsFavorite.value,
  }

  emit('save', updated)
  emit('update:visible', false)
}
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Свойства документа"
    icon="mdi:file-document-edit-outline"
    :max-width="520"
    @update:visible="emit('update:visible', $event)"
  >
    <div v-if="document" class="document-edit-content">
      <!-- Информация о файле -->
      <div class="file-summary-card">
        <div class="file-icon-box" :style="{ backgroundColor: fileTypeInfo.bgColor, color: fileTypeInfo.color }">
          <Icon :icon="fileTypeInfo.icon" width="28" height="28" />
        </div>
        <div class="file-summary-info">
          <div class="file-orig-name" :title="document.originalName">
            {{ document.originalName }}
          </div>
          <div class="file-meta-row">
            <span>{{ fileTypeInfo.label }}</span>
            <span class="dot-separator">•</span>
            <span>{{ formatBytes(document.sizeBytes) }}</span>
          </div>
        </div>
      </div>

      <form class="edit-form" @submit.prevent="handleSave">
        <!-- Название для удобства -->
        <KitInput
          v-model="localTitle"
          label="Понятное название"
          placeholder="Например: Посадочный талон Москва — Токио"
        />

        <!-- Выбор категории -->
        <div class="form-field">
          <label class="field-label">Категория</label>
          <div class="categories-selector">
            <button
              v-for="cat in DOCUMENT_CATEGORIES"
              :key="cat.id"
              type="button"
              class="category-chip"
              :class="{ 'is-selected': localCategory === cat.id }"
              :style="localCategory === cat.id ? { borderColor: cat.color, backgroundColor: `${cat.color}15`, color: cat.color } : {}"
              @click="localCategory = localCategory === cat.id ? null : cat.id"
            >
              <Icon :icon="cat.icon" width="16" height="16" />
              <span>{{ cat.label }}</span>
            </button>
          </div>
        </div>

        <!-- Выбор папки -->
        <div class="form-field">
          <label class="field-label">Папка</label>
          <div class="select-wrapper">
            <select v-model="localFolderId" class="custom-select">
              <option :value="null">
                📁 Все документы (корень)
              </option>
              <option v-for="folder in folders" :key="folder.id" :value="folder.id">
                📁 {{ folder.name }}
              </option>
            </select>
            <Icon icon="mdi:chevron-down" class="select-chevron" />
          </div>
        </div>

        <!-- Заметка / Детали -->
        <KitInput
          v-model="localNote"
          type="textarea"
          label="Заметка / Номер брони / Место"
          placeholder="Например: Терминал 2, рейс SU260, место 14A"
        />

        <!-- Доступ и Важное -->
        <div class="toggles-row">
          <!-- Звездочка / Важное -->
          <button
            type="button"
            class="toggle-card"
            :class="{ 'is-active': localIsFavorite }"
            @click="localIsFavorite = !localIsFavorite"
          >
            <Icon :icon="localIsFavorite ? 'mdi:star' : 'mdi:star-outline'" class="toggle-icon star" />
            <div class="toggle-texts">
              <span class="toggle-title">Важный документ</span>
              <span class="toggle-desc">Всегда наверху списка</span>
            </div>
          </button>

          <!-- Доступ -->
          <button
            type="button"
            class="toggle-card"
            :class="{ 'is-active': localAccess === 'public' }"
            @click="localAccess = localAccess === 'public' ? 'private' : 'public'"
          >
            <Icon :icon="localAccess === 'public' ? 'mdi:earth' : 'mdi:lock-outline'" class="toggle-icon access" />
            <div class="toggle-texts">
              <span class="toggle-title">{{ localAccess === 'public' ? 'Публичный' : 'Приватный' }}</span>
              <span class="toggle-desc">{{ localAccess === 'public' ? 'Виден по ссылке' : 'Только участники' }}</span>
            </div>
          </button>
        </div>

        <div class="form-actions">
          <KitBtn variant="outlined" @click="emit('update:visible', false)">
            Отмена
          </KitBtn>
          <KitBtn type="submit" icon="mdi:check">
            Сохранить
          </KitBtn>
        </div>
      </form>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.document-edit-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 4px 0;
}

.file-summary-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
}

.file-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--r-s);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-summary-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex-grow: 1;

  .file-orig-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--fg-tertiary-color);

    .dot-separator {
      font-size: 0.6rem;
      opacity: 0.6;
    }
  }
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.categories-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-s);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    color: var(--fg-primary-color);
  }

  &.is-selected {
    font-weight: 600;
  }
}

.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.custom-select {
  width: 100%;
  height: 44px;
  padding: 0 36px 0 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  appearance: none;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--border-focus-color);
  }
}

.select-chevron {
  position: absolute;
  right: 12px;
  pointer-events: none;
  color: var(--fg-tertiary-color);
  font-size: 1.2rem;
}

.toggles-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.toggle-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--r-m);
  border: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
  }

  &.is-active {
    border-color: var(--border-focus-color);
    background-color: rgba(var(--fg-accent-color-rgb), 0.05);

    .toggle-icon.star {
      color: #f59e0b;
    }

    .toggle-icon.access {
      color: var(--fg-success-color);
    }
  }

  .toggle-icon {
    font-size: 1.5rem;
    color: var(--fg-tertiary-color);
    flex-shrink: 0;
    transition: color 0.2s;
  }

  .toggle-texts {
    display: flex;
    flex-direction: column;
    min-width: 0;

    .toggle-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .toggle-desc {
      font-size: 0.75rem;
      color: var(--fg-tertiary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
</style>
