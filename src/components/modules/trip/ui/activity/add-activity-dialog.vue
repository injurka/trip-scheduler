<script setup lang="ts">
import type { Activity, ActivityBlock } from '../../models/activity'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { v4 as uuidv4 } from 'uuid'
import { computed, reactive, ref } from 'vue'
import { ActivityType, timeToMinutes } from '../../models/activity'
import { useActivitiesStore } from '../../store/trip.store'

const props = defineProps({
  visible: Boolean,
  selectedDay: Number,
})

const emit = defineEmits(['update:visible', 'activity-added'])

const activitiesStore = useActivitiesStore()

const activity = reactive<Activity>({
  description: '',
  startTime: '09:00',
  endTime: '10:00',
  blocks: [],
} as unknown as Activity)

const newBlock = reactive<ActivityBlock>({
  description: '',
  type: ActivityType.WALK,
} as ActivityBlock)

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

const isValid = computed(() => {
  return activity.description.trim() !== ''
    && timeToMinutes(activity.startTime) < timeToMinutes(activity.endTime)
})

function getBlockTypeName(type: ActivityType): string {
  const found = activityTypes.find(t => t.value === type)
  return found ? found.label : 'Активность'
}

function addBlock() {
  if (newBlock.description.trim() === '')
    return

  activity.blocks!.push({
    id: uuidv4(),
    description: newBlock.description,
    type: newBlock.type,
  })

  // Сброс данных нового блока
  newBlock.description = ''
  newBlock.type = ActivityType.WALK
}

function removeBlock(index: number) {
  activity.blocks!.splice(index, 1)
}

function saveActivity() {
  // Валидация
  let isValid = true
  errors.value = { description: '', time: '' }

  if (!activity.description.trim()) {
    errors.value.description = 'Введите описание активности'
    isValid = false
  }

  if (timeToMinutes(activity.startTime) >= timeToMinutes(activity.endTime)) {
    errors.value.time = 'Время окончания должно быть позже времени начала'
    isValid = false
  }

  if (!isValid)
    return

  // Создание новой активности
  const newActivity = {
    id: uuidv4(),
    day: props.selectedDay,
    startTime: activity.startTime,
    endTime: activity.endTime,
    description: activity.description,
    blocks: [...activity.blocks!],
  } as Activity

  try {
    activitiesStore.addActivity(newActivity)
    closeDialog(true)
  }
  catch (error) {
    if (error instanceof Error) {
      errors.value.time = error.message
    }
  }
}

function closeDialog(success = false) {
  // Сброс формы
  activity.description = ''
  activity.startTime = '09:00'
  activity.endTime = '10:00'
  activity.blocks = []

  emit('update:visible', false)
  if (success)
    emit('activityAdded')
}
</script>

<template>
  <Dialog
    v-model:visible="props.visible"
    modal
    header="Добавление новой активности"
    :style="{ width: '90%', maxWidth: '600px' }"
  >
    <div class="dialog-content">
      <div class="form-group">
        <label for="activity-description">Описание активности *</label>
        <InputText
          id="activity-description"
          v-model="activity.description"
          class="w-100"
          :class="{ 'p-invalid': errors.description }"
        />
        <small v-if="errors.description" class="error-text">{{ errors.description }}</small>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Время начала *</label>
          <div class="p-inputgroup">
            <InputText v-model="activity.startTime" type="time" />
          </div>
        </div>

        <div class="form-group">
          <label>Время окончания *</label>
          <div class="p-inputgroup">
            <InputText v-model="activity.endTime" type="time" />
          </div>
        </div>
      </div>

      <small v-if="errors.time" class="error-text">{{ errors.time }}</small>

      <div class="divider">
        <span>Блоки активности</span>
      </div>

      <div v-if="activity.blocks.length > 0" class="blocks-list">
        <div v-for="(block, index) in activity.blocks" :key="index" class="block-item">
          <div class="block-content">
            <div class="block-header">
              <span class="block-type">{{ getBlockTypeName(block.type) }}</span>
              <Button
                icon="pi pi-times"
                class="p-button-text p-button-danger p-button-sm"
                @click="removeBlock(index)"
              />
            </div>
            <div class="block-desc">
              {{ block.description }}
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
        @click="saveActivity"
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
    max-height: 200px;
    overflow-y: auto;
    padding-right: 8px;

    .block-item {
      padding: 8px;
      border: 1px solid var(--border-secondary-color);
      border-radius: 4px;
      background-color: var(--bg-tertiary-color);

      .block-content {
        .block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .block-type {
            font-weight: 500;
            font-size: 0.9rem;
          }
        }

        .block-desc {
          font-size: 0.9rem;
          margin-top: 4px;
          color: var(--fg-secondary-color);
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
