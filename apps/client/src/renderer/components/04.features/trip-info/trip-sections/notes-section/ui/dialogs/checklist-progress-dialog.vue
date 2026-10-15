<script setup lang="ts">
import type { TripNote } from '~/shared/services/api/model/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { getChecklistScope, parseMarkdownChecklistTasks } from '../../lib/checklist-progress'

const props = defineProps<{
  visible: boolean
  notes: TripNote[]
  currentNoteId: string | null
  readonly: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'toggleTask': [payload: { noteId: string, lineIndex: number }]
  'openNote': [noteId: string]
}>()

const scope = computed(() => getChecklistScope(props.notes, props.currentNoteId))
const tasks = computed(() => scope.value.files.flatMap(parseMarkdownChecklistTasks))
const completedCount = computed(() => tasks.value.filter(task => task.completed).length)
const openTasks = computed(() => tasks.value.filter(task => !task.completed))
const progress = computed(() => tasks.value.length > 0
  ? Math.round(completedCount.value / tasks.value.length * 100)
  : 0,
)
const scopeDescription = computed(() => scope.value.folderTitle
  ? `Папка «${scope.value.folderTitle}» и вложенные папки`
  : 'Все заметки поездки',
)
</script>

<template>
  <KitDialogWithClose
    :visible="visible"
    title="Прогресс чек-листов"
    icon="mdi:chart-box-outline"
    :max-width="620"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="checklist-progress-dialog">
      <p class="scope-description">
        {{ scopeDescription }}
      </p>

      <section class="progress-summary" aria-label="Общий прогресс задач">
        <div class="summary-copy">
          <strong>{{ completedCount }} из {{ tasks.length }}</strong>
          <span>задач выполнено</span>
        </div>
        <strong class="progress-percent">{{ progress }}%</strong>
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Выполнено ${completedCount} из ${tasks.length} задач`"
        >
          <div class="progress-value" :style="{ width: `${progress}%` }" />
        </div>
      </section>

      <section class="open-tasks-section">
        <div class="section-heading">
          <h3>Открытые задачи</h3>
          <span class="open-count">{{ openTasks.length }}</span>
        </div>

        <ul v-if="openTasks.length > 0" class="open-tasks-list">
          <li v-for="task in openTasks" :key="`${task.noteId}:${task.lineIndex}`" class="open-task">
            <input
              type="checkbox"
              :disabled="readonly"
              :aria-label="`Отметить выполненной задачу: ${task.text}`"
              @change="emit('toggleTask', { noteId: task.noteId, lineIndex: task.lineIndex })"
            >
            <span class="task-text">{{ task.text }}</span>
            <button class="task-source" type="button" @click="emit('openNote', task.noteId)">
              <Icon icon="mdi:file-document-outline" />
              {{ task.noteTitle }}
            </button>
          </li>
        </ul>
        <p v-else-if="tasks.length > 0" class="empty-message">
          Все задачи выполнены.
        </p>
        <p v-else class="empty-message">
          В этом разделе пока нет задач в формате Markdown-чекбоксов.
        </p>
      </section>
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.checklist-progress-dialog {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 12px;
}

.scope-description {
  margin: 0;
  color: var(--fg-tertiary-color);
  font-size: 0.8rem;
}

.progress-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px 16px;
  padding: 16px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background: var(--bg-secondary-color);
}

.summary-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;

  strong {
    color: var(--fg-primary-color);
    font-size: 1rem;
  }

  span {
    color: var(--fg-tertiary-color);
    font-size: 0.78rem;
  }
}

.progress-percent {
  color: var(--fg-accent-color);
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.progress-track {
  grid-column: 1 / -1;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-primary-color);
}

.progress-value {
  height: 100%;
  border-radius: inherit;
  background: var(--fg-accent-color);
  transition: width 0.2s ease;
}

.open-tasks-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;

  h3 {
    margin: 0;
    color: var(--fg-primary-color);
    font-size: 0.95rem;
  }
}

.open-count {
  display: inline-flex;
  min-width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.72rem;
  font-weight: 700;
}

.open-tasks-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: min(42vh, 380px);
  overflow-y: auto;
  margin: 0;
  padding: 0 4px 0 0;
  list-style: none;
}

.open-task {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: start;
  gap: 4px 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-s);
  background: var(--bg-primary-color);

  input {
    width: 16px;
    height: 16px;
    margin: 1px 0 0;
    accent-color: var(--fg-accent-color);
  }
}

.task-text {
  min-width: 0;
  color: var(--fg-primary-color);
  font-size: 0.86rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.task-source {
  grid-column: 2;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: none;
  color: var(--fg-tertiary-color);
  font: inherit;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: var(--fg-accent-color);
  }

  :deep(svg) {
    flex: 0 0 auto;
  }
}

.empty-message {
  margin: 0;
  padding: 20px 12px;
  border: 1px dashed var(--border-secondary-color);
  border-radius: var(--r-s);
  color: var(--fg-tertiary-color);
  font-size: 0.84rem;
  text-align: center;
}
</style>
