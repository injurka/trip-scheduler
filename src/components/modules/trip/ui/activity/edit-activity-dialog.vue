<script setup lang="ts">
import type { Activity } from '../../models/activity'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { v4 as uuidv4 } from 'uuid'
import { computed, reactive, ref, watch } from 'vue'
import { ActivityType, timeToMinutes } from '../../models/activity'
import { useActivitiesStore } from '../../store/trip.store'

const props = defineProps({
  visible: Boolean,
  activity: Object as () => Activity | null,
})

const emit = defineEmits(['update:visible', 'activity-edited'])

const activitiesStore = useActivitiesStore()

const editedActivity = reactive({
  id: '',
  day: 1,
  description: '',
  startTime: '09:00',
  endTime: '10:00',
  blocks: [] as { id: string, description: string, type?: ActivityType, images?: string[] }[],
})

const newBlock = reactive({
  description: '',
  type: ActivityType.WALK,
})

const errors = ref({
  description: '',
  time: '',
})

const activityTypes = [
  { label: 'Транспорт', value: ActivityType.TRANSPORT },
  { label: 'Прогулка', value: ActivityType.WALK },
  { label: 'Питание', value: ActivityType.FOOD },
  { label: 'Достопримечательность', value: ActivityType.ATTRACTION },
  { label: 'Отдых', value: ActivityType.RELAX },
]

// Следим за изменением активности, чтобы инициализировать форму
watch(() => props.activity, (newActivity) => {
  if (newActivity) {
    editedActivity.id = newActivity.id
    editedActivity.day = newActivity.day
    editedActivity.description = newActivity.description
    editedActivity.startTime = newActivity.startTime
    editedActivity.endTime = newActivity.endTime
    editedActivity.blocks = newActivity.blocks
      ? JSON.parse(JSON.stringify(newActivity.blocks))
      : []
  }
}, { immediate: true })

const isValid = computed(() => {
  return editedActivity.description.trim() !== ''
    && timeToMinutes(editedActivity.startTime) < timeToMinutes(editedActivity.endTime)
})

function getBlockTypeName(type: ActivityType): string {
  const found = activityTypes.find(t => t.value === type)
  return found ? found.label : 'Активность'
}

function addBlock() {
  if (newBlock.description.trim() === '')
    return

  editedActivity.blocks.push({
    id: uuidv4(),
    description: newBlock.description,
    type: newBlock.type,
  })

  // Сброс данных нового блока
  newBlock.description = ''
  newBlock.type = ActivityType.WALK
}

function removeBlock(index: number) {
  editedActivity.blocks.splice(index, 1)
}

function moveBlockUp(index: number) {
  if (index > 0) {
    const temp = editedActivity.blocks[index]
    editedActivity.blocks[index] = editedActivity.blocks[index - 1]
    editedActivity.blocks[index - 1] = temp
  }
}

function moveBlockDown(index: number) {
  if (index < editedActivity.blocks.length - 1) {
    const temp = editedActivity.blocks[index]
    editedActivity.blocks[index] = editedActivity.blocks[index + 1]
    editedActivity.blocks[index + 1] = temp
  }
}

function updateActivity() {
  // Валидация
  let isValid = true
  errors.value = { description: '', time: '' }

  if (!editedActivity.description.trim()) {
    errors.value.description = 'Введите описание активности'
    isValid = false
  }

  if (timeToMinutes(editedActivity.startTime) >= timeToMinutes(editedActivity.endTime)) {
    errors.value.time = 'Время окончания должно быть позже времени начала'
    isValid = false
  }

  if (!isValid)
    return

  try {
    activitiesStore.addActivity(editedActivity as Activity)
    closeDialog(true)
  }
  catch (error) {
    if (error instanceof Error) {
      errors.value.time = error.message
    }
  }
}

function closeDialog(success = false) {
  emit('update:visible', false)
  if (success)
    emit('activity-edited')
}
</script>

<template>
  <Dialog
    v-model:visible="props.visible"
    modal
    header="Редактирование активности"
    :style="{ width: '90%', maxWidth: '600px' }"
  >
    <div class="dialog-content">
      <div class="form-group">
        <label for="activity-description">Описание активности *</label>
        <InputText
          id="activity-description"
          v-model="editedActivity.description"
          class="w-100"
          :class="{ 'p-invalid': errors.description }"
        />
        <small v-if="errors.description" class="error-text">{{ errors.description }}</small>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Время начала *</label>
          <div class="p-inputgroup">
            <InputText v-model="editedActivity.startTime" type="time" />
          </div>
        </div>

        <div class="form-group">
          <label>Время окончания *</label>
          <div class="p-inputgroup">
            <InputText v-model="editedActivity.endTime" type="time" />
          </div>
        </div>
      </div>

      <small v-if="errors.time" class="error-text">{{ errors.time }}</small>

      <div class="divider">
        <span>Блоки активности</span>
      </div>

      <div v-if="editedActivity.blocks.length > 0" class="blocks-list">
        <div v-for="(block, index) in editedActivity.blocks" :key="block.id" class="block-item">
          <div class="block-content">
            <div class="block-header">
              <span class="block-type">{{ getBlockTypeName(block.type as ActivityType) }}</span>
              <div class="block-actions">
                <Button
                  icon="pi pi-arrow-up"
                  class="p-button-text p-button-sm"
                  :disabled="index === 0"
                  @click="moveBlockUp(index)"
                />
                <Button
                  icon="pi pi-arrow-down"
                  class="p-button-text p-button-sm"
                  :disabled="index === editedActivity.blocks.length - 1"
                  @click="moveBlockDown(index)"
                />
                <Button
                  icon="pi pi-times"
                  class="p-button-text p-button-danger p-button-sm"
                  @click="removeBlock(index)"
                />
              </div>
            </div>
            <div class="block-desc">
              {{ block.description }}
            </div>

            <div v-if="block.images && block.images.length" class="block-images">
              <img
                v-for="(image, idx) in block.images"
                :key="idx"
                :src="image"
                alt="Изображение блока"
                class="block-image-thumbnail"
              >
            </div>
          </div>
        </div>
      </div>

      <div class="add-block">
        <div class="form-group">
          <label for="block-type">Тип блока</label>
          <Dropdown
            id="block-type"
            v-model="newBlock.type"
            :options="activityTypes"
            option-label="label"
            option-value="value"
            placeholder="Выберите тип"
            class="w-100"
          />
        </div>

        <div class="form-group">
          <label for="block-description">Описание блока</label>
          <Textarea
            id="block-description"
            v-model="newBlock.description"
            rows="3"
            class="w-100"
            placeholder="Введите детали блока активности..."
          />
        </div>

        <Button
          label="Добавить блок"
          icon="pi pi-plus"
          class="p-button-outlined"
          :disabled="!newBlock.description.trim()"
          @click="addBlock"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Отмена" icon="pi pi-times" class="p-button-text" @click="closeDialog()" />
      <Button
        label="Сохранить"
        icon="pi pi-check"
        class="p-button-primary"
        :disabled="!isValid"
        @click="updateActivity"
      />
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }

    .w-100 {
      width: 100%;
    }
  }

  .form-row {
    display: flex;
    gap: 16px;

    .form-group {
      flex: 1;
    }
  }

  .divider {
    display: flex;
    align-items: center;
    margin: 16px 0 8px;

    &::before,
    &::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid var(--border-secondary-color);
    }

    span {
      padding: 0 10px;
      color: var(--fg-secondary-color);
      font-size: 0.9rem;
      font-weight: 500;
    }
  }

  .blocks-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
    padding-right: 8px;

    .block-item {
      padding: 12px;
      border: 1px solid var(--border-secondary-color);
      border-radius: 4px;
      background-color: var(--bg-tertiary-color);
      transition: background-color 0.2s ease;

      &:hover {
        background-color: var(--bg-hover-color);
      }

      .block-content {
        .block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .block-type {
            font-weight: 500;
            font-size: 0.9rem;
          }

          .block-actions {
            display: flex;
            gap: 4px;
          }
        }

        .block-desc {
          font-size: 0.9rem;
          margin-top: 6px;
          color: var(--fg-secondary-color);
          white-space: pre-line;
        }

        .block-images {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;

          .block-image-thumbnail {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.2s ease;

            &:hover {
              transform: scale(1.1);
            }
          }
        }
      }
    }
  }

  .add-block {
    padding: 16px;
    border: 1px dashed var(--border-secondary-color);
    border-radius: 8px;
    background-color: var(--bg-tertiary-color);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .error-text {
    color: var(--red-500);
    font-size: 0.85rem;
  }
}
</style>
