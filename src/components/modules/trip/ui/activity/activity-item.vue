<script setup lang="ts">
import type { Activity } from '~/components/modules/trip/models/activity'
import { ref } from 'vue'
import { ActivityType, activityTypeIcons } from '~/components/modules/trip/models/activity'
import { MarkdownContent } from '~/components/shared/markdown-content'

interface ActivityItemProps {
  activity: Activity
}

const props = defineProps<ActivityItemProps>()
const emit = defineEmits(['edit', 'delete'])

// Для отображения подробностей активности
const showDetails = ref(true)

// Функции для обработки действий
function handleEdit() {
  emit('edit', props.activity)
}

function handleDelete() {
  // eslint-disable-next-line no-alert
  if (confirm('Вы уверены, что хотите удалить эту активность?')) {
    emit('delete', props.activity.id)
  }
}

function toggleDetails() {
  showDetails.value = !showDetails.value
}

function getActivityTypeColor(type: ActivityType | undefined) {
  if (!type)
    return ''

  const colors = {
    [ActivityType.TRANSPORT]: 'var(--blue-50)',
    [ActivityType.WALK]: 'var(--green-50)',
    [ActivityType.FOOD]: 'var(--yellow-50)',
    [ActivityType.ATTRACTION]: 'var(--purple-50)',
    [ActivityType.RELAX]: 'var(--cyan-50)',
  }

  return colors[type] || ''
}
</script>

<template>
  <div class="activity-item">
    <div class="drag-handle" />

    <div class="activity-header">
      <div class="activity-time">
        {{ activity.startTime }} - {{ activity.endTime }}
      </div>

      <div class="activity-actions">
        <button class="icon-button" @click="handleEdit">
          <i class="pi pi-pencil" />
        </button>
        <button class="icon-button delete" @click="handleDelete">
          <i class="pi pi-trash" />
        </button>
        <button class="icon-button" @click="toggleDetails">
          <i :class="showDetails ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
        </button>
      </div>
    </div>

    <div class="activity-content">
      <h3 class="activity-title">
        {{ activity.description }}
      </h3>

      <div v-if="showDetails && activity.blocks && activity.blocks.length" class="activity-blocks">
        <div
          v-for="block in activity.blocks"
          :key="block.id"
          class="activity-block"
          :style="{ backgroundColor: getActivityTypeColor(block.type) }"
        >
          <div v-if="block.type" class="block-header">
            <i :class="activityTypeIcons[block.type]" />
            <span v-if="block.startTime" class="block-time">{{ block.startTime }}</span>
          </div>

          <MarkdownContent
            class="block-description"
            :content="block.description"
          />

          <div v-if="block.images && block.images.length" class="block-images">
            <img
              v-for="(image, idx) in block.images"
              :key="idx"
              :src="image"
              alt="Изображение активности"
              class="block-image"
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
  transition: all 0.3s ease;
  margin: 12px 0;

  &:hover {
    .activity-header {
      .activity-time {
        &::before {
          opacity: 1;
          color: var(--fg-accent-color);
        }
      }
    }

    .activity-content {
      box-shadow: 0 2px 8px var(--border-secondary-color);

      &::before {
        background-color: var(--fg-accent-color);
      }
    }
  }
  

  .drag-handle {
    position: absolute;
    left: -19px;
    width: 18px;
    top: 50%;
    height: 100%;
    transform: translateY(-50%);
    cursor: grab;
    padding: 8px;

    &:active {
      cursor: grabbing;
    }
  }

  .activity-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .activity-time {
      position: relative;
      line-height: normal;
      font-weight: 600;
      color: var(--fg-accent-color);
      padding: 4px;

      &::before {
        position: absolute;
        left: -15px;
        top: 6px;
        content: '✦';
        color: var(--fg-accent-color);
        font-size: 0.8rem;
        color: var(--fg-secondary-color);
        opacity: 0.5;
        transition:
          color 0.2s ease,
          opacity 0.2s ease;
      }
    }

    .activity-actions {
      display: flex;
      gap: 4px;

      .icon-button {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: var(--fg-secondary-color);
        transition: all 0.2s ease;
        border-radius: 50%;

        &:hover {
          color: var(--fg-accent-color);
          background-color: var(--bg-hover-color);
        }

        &.delete:hover {
          color: var(--red-500);
        }
      }
    }
  }

  .activity-content {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 12px;
    border-radius: 8px;
    transition:
      box-shadow 0.2s ease,
      transform 0.2s ease;
    position: relative;
    overflow: visible !important;

    &::before {
      position: absolute;
      left: -12px;
      top: 0px;
      content: '';
      color: var(--fg-accent-color);
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      height: 100%;
      width: 2px;
      background-color: var(--border-secondary-color);
      transition: background-color 0.2s ease;
    }

    .activity-title {
      font-size: 1rem;
      font-weight: 400;
      margin: 0;
      color: var(--fg-primary-color);
    }

    .activity-blocks {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .activity-block {
        padding: 10px;
        border-radius: 6px;
        border: 1px solid var(--border-secondary-color);
        transition: all 0.2s ease;
        .block-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;

          i {
            font-size: 1rem;
            color: var(--fg-secondary-color);
          }
          .block-time {
            font-size: 0.85rem;
            color: var(--fg-secondary-color);
            margin-left: auto;
          }
        }

        .block-description {
          font-size: 0.95rem;
          color: var(--fg-primary-color);
          &:deep() {
            > p {
              padding: 0;
              margin: 0;
              margin-bottom: 8px;

              &:last-child {
                margin-bottom: 0;
              }
            }

            a img {
              max-width: 100%;
              height: auto;
              border-radius: 4px;
            }

            blockquote {
              border-left: 3px solid var(--border-primary-color);
              margin-left: 0;
              padding-left: 16px;
              color: var(--fg-secondary-color);
            }

            details {
              padding: 8px;
              border: 1px solid var(--border-secondary-color);
              border-radius: 4px;
              background-color: var(--bg-tertiary-color);

              summary {
                cursor: pointer;
                user-select: none;
                font-weight: 500;
              }
            }
          }
        }

        .block-images {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;

          .block-image {
            width: 100px;
            height: 100px;
            object-fit: cover;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.2s ease;
          }
        }
      }
    }
  }
}
</style>
