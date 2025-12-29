<script setup lang="ts">
import type { PostMedia } from  '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import draggable from 'vuedraggable'
import { KitImage } from '~/components/01.kit/kit-image'
import MediaLibraryPicker from '../tools/media-library-picker.vue'
import SmartMarkEditor from '../tools/smart-mark-editor.vue'

interface IProps {
  images: PostMedia[]
}

const props = defineProps<IProps>()

const emit = defineEmits<{
  (e: 'update:images', images: PostMedia[]): void
}>()

const isLibraryOpen = ref(false)
const isMarkEditorOpen = ref(false)
const mediaToEdit = ref<PostMedia | null>(null)
const editingIndex = ref(-1)

function openMarkEditor(media: PostMedia, index: number) {
  mediaToEdit.value = media
  editingIndex.value = index
  isMarkEditorOpen.value = true
}

function handleSaveMarks(updatedMedia: PostMedia) {
  const newImages = [...props.images]
  if (editingIndex.value !== -1) {
    newImages[editingIndex.value] = updatedMedia
    emit('update:images', newImages)
  }
}

function removeImage(index: number) {
  const newImages = [...props.images]
  newImages.splice(index, 1)
  emit('update:images', newImages)
}

function handleLibraryConfirm(selected: PostMedia[]) {
  const currentIds = new Set(props.images.map(img => img.id))
  const newToAdd = selected.filter(img => !currentIds.has(img.id))

  emit('update:images', [...props.images, ...newToAdd])
}

const currentSelectedIds = computed(() => props.images.map(i => i.id))
</script>

<template>
  <div class="gallery-editor">
    <div v-if="images.length > 0" class="grid-wrapper">
      <draggable
        :list="images"
        item-key="id"
        class="gallery-grid"
        handle=".drag-handle"
        @end="emit('update:images', images)"
      >
        <template #item="{ element, index }">
          <div class="gallery-item">
            <div class="drag-handle">
              <Icon icon="mdi:drag" />
            </div>

            <div class="image-preview" @click="openMarkEditor(element, index)">
              <KitImage :src="element.url" object-fit="cover" />

              <div v-if="element.marks?.length" class="marks-badge">
                <Icon icon="mdi:target" /> {{ element.marks.length }}
              </div>

              <div class="hover-overlay">
                <Icon icon="mdi:pencil" />
                <span>Отметки</span>
              </div>
            </div>

            <button class="remove-btn" title="Убрать из блока" @click.stop="removeImage(index)">
              <Icon icon="mdi:close-circle" />
            </button>
          </div>
        </template>
      </draggable>
    </div>

    <button class="add-image-btn" @click="isLibraryOpen = true">
      <div class="btn-content">
        <Icon icon="mdi:image-plus" width="24" height="24" />
        <span>{{ images.length > 0 ? 'Добавить ещё' : 'Выбрать фото' }}</span>
      </div>
    </button>

    <MediaLibraryPicker
      v-model:visible="isLibraryOpen"
      :selected-ids="currentSelectedIds"
      mode="select"
      @confirm="handleLibraryConfirm"
    />

    <SmartMarkEditor
      v-if="mediaToEdit"
      v-model:visible="isMarkEditorOpen"
      :media="mediaToEdit"
      @save="handleSaveMarks"
    />
  </div>
</template>

<style scoped lang="scss">
.grid-wrapper {
  margin-bottom: 8px;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.gallery-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--r-s);
  overflow: hidden;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);

  &:hover {
    .remove-btn,
    .drag-handle {
      opacity: 1;
    }
  }
}

.image-preview {
  width: 100%;
  height: 100%;
  cursor: pointer;
  position: relative;

  &:hover .hover-overlay {
    opacity: 1;
  }
}

.hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.8rem;
  opacity: 0;
  transition: opacity 0.2s;
  gap: 4px;
}

.drag-handle {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 4px;
  padding: 2px;
  cursor: grab;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.2s;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fg-error-color);
  opacity: 0;
  z-index: 2;
  transition: opacity 0.2s;

  &:hover {
    transform: scale(1.1);
  }
}

.marks-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.add-image-btn {
  width: 100%;
  padding: 12px;
  border: 2px dashed var(--border-secondary-color);
  border-radius: var(--r-s);
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    background: var(--bg-hover-color);
  }

  .btn-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 500;
  }
}
</style>
