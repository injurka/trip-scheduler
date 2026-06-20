<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import { trpc } from '~/shared/services/trpc/trpc.service'
import LlmCanvasAssistant from './llm-canvas-assistant.vue'

const { ui, plan } = useModuleStore(['ui', 'plan'])
const { isViewMode } = storeToRefs(ui)
const { getSelectedDay, isLoadingUpdateNote, isLoadingNote } = storeToRefs(plan)

const noteContent = ref('')
const isInitialized = ref(false)

watch(getSelectedDay, async (newDay) => {
  if (!newDay)
    return

  isInitialized.value = false

  const cachedNote = plan.getNoteForCurrentDay
  if (cachedNote !== null) {
    noteContent.value = cachedNote
  }

  await plan.fetchDayNote(newDay.id)

  if (plan.getNoteForCurrentDay !== null) {
    noteContent.value = plan.getNoteForCurrentDay
  }

  isInitialized.value = true
}, { immediate: true })

const saveToDb = useDebounceFn((val: string) => {
  if (!getSelectedDay.value)
    return
  plan.updateDayNote(getSelectedDay.value.id, val)
}, 1000)

function onContentUpdate(val: string) {
  noteContent.value = val

  if (isInitialized.value && !isViewMode.value) {
    saveToDb(val)
  }
}

const assistantRef = ref<InstanceType<typeof LlmCanvasAssistant> | null>(null)
const generatedDraft = ref<string | null>(null)
const isGeneratingDraft = ref(false)

async function handleGenerate({ prompt, useDaysContext }: { prompt: string, useDaysContext: boolean }) {
  if (!getSelectedDay.value) return
  isGeneratingDraft.value = true
  
  try {
    const response = await trpc.day.generateNote.mutate({
      dayId: getSelectedDay.value.id,
      prompt,
      useContext: useDaysContext,
    })
    
    generatedDraft.value = noteContent.value 
      + '\n\n---\n\n✨ **[AI]** Сгенерированный контент:\n\n' + response
  } catch (error) {
    console.error('Failed to generate AI note:', error)
    // Optional: show kit-toast error here
  } finally {
    isGeneratingDraft.value = false
    assistantRef.value?.finishGeneration()
  }
}

function acceptDraft() {
  if (generatedDraft.value !== null) {
    onContentUpdate(generatedDraft.value)
  }
  generatedDraft.value = null
}

function discardDraft() {
  generatedDraft.value = null
}
</script>

<template>
  <div class="day-note">
    <LlmCanvasAssistant ref="assistantRef" v-if="!isViewMode" hide-canvas-ref @generate="handleGenerate" />

    <div class="note-container" :class="{ 'is-draft': generatedDraft !== null }">
      <div class="status-bar">
        <transition name="status-fade" mode="out-in">
          <span v-if="isLoadingNote && !isInitialized" key="loading" class="status loading">
            <Icon icon="mdi:loading" class="spin" /> Загрузка...
          </span>
          <span v-else-if="isLoadingUpdateNote" key="saving" class="status saving">
            <Icon icon="mdi:cloud-upload-outline" /> Сохранение...
          </span>
          <span v-else key="saved" class="status saved">
            <Icon icon="mdi:cloud-check-outline" /> Сохранено
          </span>
        </transition>
      </div>

      <div v-if="isGeneratingDraft" class="draft-loading">
        <Icon icon="mdi:loading" class="spin-icon draft-spinner" />
        <span>Нейросеть генерирует план...</span>
      </div>

      <div v-else-if="generatedDraft !== null" class="draft-preview">
        <div class="draft-header">
          <span class="draft-title"><Icon icon="mdi:eye-outline" /> Предпросмотр изменений</span>
          <div class="draft-actions">
            <KitBtn variant="subtle" size="sm" @click="discardDraft">Отклонить</KitBtn>
            <KitBtn color="primary" size="sm" @click="acceptDraft">Применить</KitBtn>
          </div>
        </div>
        <div class="draft-editor-wrapper">
          <KitInlineMdEditorWrapper
            :model-value="generatedDraft"
            :readonly="true"
            class="note-editor draft-editor"
          />
        </div>
      </div>

      <KitInlineMdEditorWrapper
        v-else
        :model-value="noteContent"
        :readonly="isViewMode"
        placeholder="Свободное полотно для заметок, идей и набросков этого дня..."
        class="note-editor"
        :features="{
          'block-edit': true,
          'image-block': true,
          'list-item': true,
          'link-tooltip': true,
          'toolbar': true,
        }"
        @update:model-value="onContentUpdate"
      />

      <transition name="faded">
        <div v-if="noteContent && !isLoadingNote && !isLoadingUpdateNote && generatedDraft === null" class="note-container-tip">
          Markdown поддерживается *
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped lang="scss">
.day-note {
  width: 100%;
  height: 100%;
  min-height: 500px;
}

.note-container {
  position: relative;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  padding: 16px;
  padding-top: 32px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 32px;

  &-tip {
    position: absolute;
    bottom: 12px;
    right: 12px;
    color: var(--fg-tertiary-color);
    font-family: 'Sansation';
    font-size: 0.7rem;
    pointer-events: none;
    z-index: 10;
  }

  &.is-draft {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 1px var(--fg-accent-color);
  }
}

.draft-preview {
  display: flex;
  flex-direction: column;
  flex-grow: 1;

  .draft-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px dashed var(--border-secondary-color);

    .draft-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--fg-accent-color);
      font-weight: 600;
    }

    .draft-actions {
      display: flex;
      gap: 8px;
    }
  }

  .draft-editor-wrapper {
    flex-grow: 1;
    background-color: var(--bg-primary-color);
    border-radius: var(--r-s);
    padding: 12px;
    border: 1px solid var(--border-secondary-color);
    opacity: 0.8;
  }
}

.status-bar {
  position: absolute;
  top: 8px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 0.75rem;
  pointer-events: none;
  min-width: 100px;
  z-index: 10;

  .status {
    display: flex;
    align-items: center;
    gap: 4px;

    &.loading {
      color: var(--fg-accent-color);
    }
    &.saving {
      color: var(--fg-tertiary-color);
    }
    &.saved {
      color: var(--fg-success-color);
      opacity: 0.7;
    }
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
}

.draft-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  color: var(--fg-accent-color);
  gap: 16px;
  font-weight: 500;
  
  .draft-spinner {
    font-size: 3rem;
  }
}

.note-editor {
  flex-grow: 1;
  height: auto;
  min-height: 400px;

  :deep(.milkdown) {
    min-height: 100%;
    padding-bottom: 24px;
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

.faded-enter-active,
.faded-leave-active {
  transition: opacity 0.3s ease;
}
.faded-enter-from,
.faded-leave-to {
  opacity: 0;
}

.status-fade-enter-active,
.status-fade-leave-active {
  transition: all 0.2s ease;
}
.status-fade-enter-from {
  opacity: 0;
  transform: translateY(-5px);
}
.status-fade-leave-to {
  opacity: 0;
  transform: translateY(5px);
}
</style>
