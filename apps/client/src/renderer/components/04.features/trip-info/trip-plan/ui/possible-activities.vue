<!-- eslint-disable unused-imports/no-unused-vars -->
<script setup lang="ts">
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDialogWithClose } from '~/components/01.kit/kit-dialog-with-close'
import { KitInput } from '~/components/01.kit/kit-input'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

const { ui } = useModuleStore(['plan', 'ui'])
const { isPossibleActivitiesDrawerOpen } = storeToRefs(ui)

const newActivityTitle = ref('')

// ui.closePossibleActivitiesDrawer()

// TODO позже
// function handleUseActivity(_activity: IActivity) {
//   if (!selectedDay.value)
//     return
// }

// function handleAddPossibleActivity() {
//   if (!newActivityTitle.value.trim())
//     return

//   const newActivityData = {
//     title: newActivityTitle.value,
//     startTime: '00:00', // Default, user will change when scheduling
//     endTime: '01:00', // Default
//     tag: EActivityTag.ATTRACTION,
//     sections: [],
//     status: EActivityStatus.NONE,
//   }
//   newActivityTitle.value = ''
// }

// function handleRemovePossible(_activityId: string) {
// }
</script>

<template>
  <KitDialogWithClose
    v-model:visible="isPossibleActivitiesDrawerOpen"
    title="Возможные активности"
    icon="mdi:lightbulb-on-outline"
    :max-width="500"
    position="right"
  >
    <div class="possible-activities-drawer">
      <form class="add-new-form">
        <KitInput
          v-model="newActivityTitle"
          placeholder="Добавить новую идею..."
        />
        <KitBtn
          :disabled="!newActivityTitle.trim()"
          type="submit"
        >
          Добавить
        </KitBtn>
      </form>
      <!-- <ul v-if="possibleActivities.length > 0" class="activities-list">
        <li v-for="activity in possibleActivities" :key="activity.id" class="activity-item">
          <div class="activity-info">
            <span
              v-if="getTagInfo(activity.tag)"
              class="tag-icon"
              :style="{ backgroundColor: getTagInfo(activity.tag)?.color }"
            >
              <Icon :icon="getTagInfo(activity.tag)!.icon" />
            </span>
            <span class="activity-title">{{ activity.title }}</span>
          </div>
          <div class="activity-actions">
            <KitBtn variant="subtle" size="sm" :disabled="!selectedDay" @click="handleUseActivity(activity)">
              Использовать
            </KitBtn>
            <button class="delete-btn" title="Удалить идею" @click="handleRemovePossible(activity.id)">
              <Icon icon="mdi:trash-can-outline" />
            </button>
          </div>
        </li>
      </ul>
      <div v-else class="empty-state">
        <Icon icon="mdi:lightbulb-off-outline" />
        <p>Список идей пуст</p>
        <span>Добавьте новые идеи, чтобы использовать их в маршруте.</span>
      </div> -->
    </div>
  </KitDialogWithClose>
</template>

<style scoped lang="scss">
.possible-activities-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.add-new-form {
  display: flex;
  gap: 8px;
}

.activities-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-radius: var(--r-s);
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
}

.activity-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tag-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 0.9rem;
}

.activity-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  background: transparent;
  border: none;
  color: var(--fg-secondary-color);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  &:hover {
    color: var(--fg-error-color);
    background-color: var(--bg-hover-color);
  }
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--fg-secondary-color);
  .iconify {
    font-size: 2.5rem;
    margin-bottom: 8px;
  }
  p {
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--fg-primary-color);
  }
  span {
    font-size: 0.85rem;
  }
}
</style>
