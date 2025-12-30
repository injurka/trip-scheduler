<script setup lang="ts">
import type { PostMedia } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { useFileDialog } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import draggable from 'vuedraggable'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitImage } from '~/components/01.kit/kit-image'
import { usePostDraftStore } from '../../../store/post-draft.store'

interface Props {
  visible: boolean
  selectedIds?: string[]
  mode?: 'select' | 'manage'
  single?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedIds: () => [],
  mode: 'select',
  single: false,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', media: PostMedia[]): void
}>()

const store = usePostDraftStore()
const confirm = useConfirm()
const { open, onChange } = useFileDialog({
  accept: 'image/*',
  multiple: true,
})

const { post } = storeToRefs(store)
const localSelectedIds = ref<string[]>([])

function toggleSelection(id: string) {
  if (props.mode === 'manage')
    return

  if (props.single) {
    if (localSelectedIds.value.includes(id)) {
      localSelectedIds.value = []
    }
    else {
      localSelectedIds.value = [id]
    }
    return
  }

  if (localSelectedIds.value.includes(id)) {
    localSelectedIds.value = localSelectedIds.value.filter(sid => sid !== id)
  }
  else {
    localSelectedIds.value.push(id)
  }
}

function handleConfirm() {
  const selectedMedia = post.value.media.filter(m => localSelectedIds.value.includes(m.id))
  emit('confirm', selectedMedia)
  emit('update:visible', false)
}

async function handleDelete(id: string) {
  const isConfirmed = await confirm({
    title: 'Удалить картинку из поста? Она пропадет из всех блоков.',
    description: 'Это действие необратимо. Все ваши данные будут удалены.',
    type: 'danger',
    confirmText: 'Да, удалить мой аккаунт',
  })

  if (isConfirmed) {
    store.removeGlobalMedia(id)
    localSelectedIds.value = localSelectedIds.value.filter(sid => sid !== id)
  }
}

onChange((files) => {
  if (!files || files.length === 0)
    return
  const addedMedia = store.addGlobalMedia(Array.from(files))

  if (props.mode === 'select') {
    if (props.single) {
      localSelectedIds.value = [addedMedia[addedMedia.length - 1].id]
    }
    else {
      addedMedia.forEach(m => localSelectedIds.value.push(m.id))
    }
  }
})

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    localSelectedIds.value = [...props.selectedIds]
  }
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    :title="mode === 'select' ? (single ? 'Выбрать обложку' : 'Выбрать медиа') : 'Медиатека поста'"
    icon="mdi:image-multiple-outline"
    :max-width="900"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="library-container">
      <div class="toolbar">
        <button class="upload-btn" @click="open()">
          <Icon icon="mdi:cloud-upload-outline" />
          <span>Загрузить фото</span>
        </button>

        <div class="stats">
          Всего: {{ post.media.length }}
        </div>
      </div>

      <div v-if="post.media.length === 0" class="empty-state">
        <Icon icon="mdi:image-filter-hdr" class="empty-icon" />
        <p>Медиатека пуста. Загрузите фотографии, чтобы использовать их в посте.</p>
      </div>

      <draggable
        v-else
        v-model="post.media"
        item-key="id"
        class="media-grid"
        handle=".drag-handle"
        :disabled="mode === 'select'"
        @end="store.isDirty = true"
      >
        <template #item="{ element: media }">
          <div
            class="media-card"
            :class="{ selected: localSelectedIds.includes(media.id) && mode === 'select' }"
            @click="toggleSelection(media.id)"
          >
            <div v-if="mode === 'manage'" class="drag-handle">
              <Icon icon="mdi:drag" />
            </div>
            <KitImage :src="media.url" object-fit="cover" class="media-img" />

            <div v-if="mode === 'select'" class="selection-overlay">
              <div class="checkbox">
                <Icon v-if="localSelectedIds.includes(media.id)" icon="mdi:check" />
              </div>
            </div>

            <button class="delete-btn" @click.stop="handleDelete(media.id)">
              <Icon icon="mdi:trash-can-outline" />
            </button>
          </div>
        </template>
      </draggable>

      <div class="footer-actions">
        <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
          {{ mode === 'select' ? 'Отмена' : 'Закрыть' }}
        </KitBtn>
        <KitBtn v-if="mode === 'select'" :disabled="localSelectedIds.length === 0" @click="handleConfirm">
          {{ single ? 'Выбрать' : `Выбрать (${localSelectedIds.length})` }}
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.library-container {
  display: flex;
  flex-direction: column;
  height: 70vh;
  max-height: 700px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-secondary-color);
  margin-bottom: 16px;
}

.upload-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  color: var(--fg-primary-color);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
  }
}

.stats {
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
}

.media-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  grid-auto-rows: 140px;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
}

.media-card {
  position: relative;
  border-radius: var(--r-m);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--bg-tertiary-color);
  transition: all 0.2s;

  &.selected {
    border-color: var(--fg-accent-color);
    .selection-overlay {
      background: rgba(var(--fg-accent-color-rgb), 0.2);
      .checkbox {
        background: var(--fg-accent-color);
        border-color: var(--fg-accent-color);
        color: white;
      }
    }
  }

  &:hover {
    .delete-btn,
    .drag-handle {
      opacity: 1;
    }
  }
}

.drag-handle {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.2s;

  &:active {
    cursor: grabbing;
  }
}

.media-img {
  width: 100%;
  height: 100%;
}

.selection-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 8px;
  transition: all 0.2s;
}

.checkbox {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid white;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.delete-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: white;
  color: var(--fg-error-color);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;

  &:hover {
    background: var(--fg-error-color);
    color: white;
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
  text-align: center;
  gap: 16px;

  .empty-icon {
    font-size: 64px;
    opacity: 0.5;
  }
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
  margin-top: 16px;
}
</style>
