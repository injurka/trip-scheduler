<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { KitInlineMdEditorWrapper } from '~/components/01.kit/kit-inline-md-editor'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

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
</script>

<template>
  <div class="day-note">
    <div class="note-container">
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

      <KitInlineMdEditorWrapper
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
        <div v-if="noteContent && !isLoadingNote && !isLoadingUpdateNote" class="note-container-tip">
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
