<script setup lang="ts">
import type { PostMark, PostMedia } from '~/shared/types/models/post'
import { Icon } from '@iconify/vue'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { resolveApiUrl } from '~/shared/lib/url'

interface Props {
  visible: boolean
  media: PostMedia
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', media: PostMedia): void
}>()

const currentMedia = ref<PostMedia>(JSON.parse(JSON.stringify(props.media)))
const imageContainerRef = ref<HTMLElement | null>(null)
const activeMarkId = ref<string | null>(null)
const markLabelInput = ref('')

const resolvedImageUrl = computed(() => {
  return resolveApiUrl(currentMedia.value.url)
})

function handleImageClick(event: MouseEvent) {
  if (!imageContainerRef.value)
    return

  const rect = imageContainerRef.value.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const y = ((event.clientY - rect.top) / rect.height) * 100

  const newMark: PostMark = {
    id: uuidv4(),
    x,
    y,
    label: '',
  }

  if (!currentMedia.value.marks) {
    currentMedia.value.marks = []
  }

  currentMedia.value.marks.push(newMark)
  startEditingMark(newMark.id)
}

function startEditingMark(id: string) {
  activeMarkId.value = id
  const mark = currentMedia.value.marks?.find(m => m.id === id)
  markLabelInput.value = mark?.label || ''
}

function saveActiveMark() {
  if (!activeMarkId.value)
    return

  const mark = currentMedia.value.marks?.find(m => m.id === activeMarkId.value)
  if (mark) {
    if (!markLabelInput.value.trim()) {
      removeMark(activeMarkId.value)
    }
    else {
      mark.label = markLabelInput.value
    }
  }
  activeMarkId.value = null
}

function removeMark(id: string) {
  if (currentMedia.value.marks) {
    currentMedia.value.marks = currentMedia.value.marks.filter(m => m.id !== id)
  }
  if (activeMarkId.value === id) {
    activeMarkId.value = null
  }
}

function handleSave() {
  saveActiveMark()
  emit('save', currentMedia.value)
  emit('update:visible', false)
}

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    currentMedia.value = JSON.parse(JSON.stringify(props.media))
  }
})
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Отметки на фото"
    :max-width="800"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="editor-container">
      <div class="instructions">
        <Icon icon="mdi:gesture-tap" />
        <span>Кликните на фото, чтобы добавить метку</span>
      </div>

      <div class="canvas-wrapper">
        <div
          ref="imageContainerRef"
          class="image-canvas"
          @click="handleImageClick"
        >
          <img :src="resolvedImageUrl" alt="" class="target-image">

          <div
            v-for="mark in currentMedia.marks"
            :key="mark.id"
            class="mark-point"
            :class="{ 'is-active': activeMarkId === mark.id }"
            :style="{ left: `${mark.x}%`, top: `${mark.y}%` }"
            @click.stop="startEditingMark(mark.id)"
          >
            <div class="dot" />

            <div v-if="activeMarkId === mark.id" class="edit-popover" @click.stop>
              <input
                v-model="markLabelInput"
                class="mini-input"
                placeholder="Что это?"
                @keydown.enter="saveActiveMark"
              >
              <button class="icon-btn save" @click="saveActiveMark">
                <Icon icon="mdi:check" />
              </button>
              <button class="icon-btn delete" @click="removeMark(mark.id)">
                <Icon icon="mdi:trash-can-outline" />
              </button>
            </div>

            <div v-else class="mark-label">
              {{ mark.label }}
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <KitBtn variant="outlined" color="secondary" @click="emit('update:visible', false)">
          Отмена
        </KitBtn>
        <KitBtn @click="handleSave">
          Сохранить
        </KitBtn>
      </div>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.editor-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.instructions {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  background: var(--bg-tertiary-color);
  padding: 8px 12px;
  border-radius: var(--r-s);
}

.canvas-wrapper {
  background: var(--bg-tertiary-color);
  display: flex;
  justify-content: center;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  overflow: hidden;
  user-select: none;
  min-height: 200px;
}

.image-canvas {
  position: relative;
  display: inline-block;
  cursor: crosshair;
  max-width: 100%;
}

.target-image {
  display: block;
  max-width: 100%;
  max-height: 60vh;
  width: auto;
  height: auto;
}

.mark-point {
  position: absolute;
  transform: translate(-50%, -50%);
}

.dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 3px solid var(--fg-accent-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s;
  cursor: pointer;
}

.mark-point:hover .dot,
.mark-point.is-active .dot {
  transform: scale(1.2);
  background: white;
}

.mark-label {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
}

.edit-popover {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-primary-color);
  padding: 6px;
  border-radius: var(--r-m);
  box-shadow: var(--s-l);
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 10;
  border: 1px solid var(--border-secondary-color);
  cursor: default;
}

.mini-input {
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  padding: 6px 10px;
  font-size: 14px;
  width: 160px;
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  outline: none;
  &:focus {
    border-color: var(--fg-accent-color);
  }
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--r-s);
  cursor: pointer;
  transition: all 0.2s;

  &.save {
    background: rgba(var(--bg-success-color-rgb), 0.1);
    color: var(--fg-success-color);
    &:hover {
      background: var(--bg-success-color);
      color: white;
    }
  }
  &.delete {
    background: rgba(var(--bg-error-color-rgb), 0.1);
    color: var(--fg-error-color);
    &:hover {
      background: var(--bg-error-color);
      color: white;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
