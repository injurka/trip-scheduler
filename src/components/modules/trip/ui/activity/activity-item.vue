<script setup lang="ts">
import type { Activity } from '../../models/activity'
import Button from 'primevue/button'
import { computed } from 'vue'

import { activityTypeIcons } from '../../models/activity'

interface ActivityItemProps {
  activity: Activity
}

const props = defineProps<ActivityItemProps>()

const emit = defineEmits<{
  (e: 'edit', activity: Activity): void
  (e: 'delete', id: string): void
}>()

const icon = computed(() => activityTypeIcons[props.activity.type])

function handleEdit(): void {
  emit('edit', props.activity)
}

function handleDelete(): void {
  emit('delete', props.activity.id)
}
</script>

<template>
  <div class="activity-item">
    <div class="activity-header">
      <i :class="icon" style="font-size: small" class="activity-icon pi mr-2" />
      <div class="activity-time">
        {{ activity.startTime }} - {{ activity.endTime }}
      </div>
      <div class="activity-actions">
        <Button v-tooltip="'Edit'" icon="pi pi-pencil" rounded text size="small" @click.stop="handleEdit" />
        <Button v-tooltip="'Delete'" icon="pi pi-trash" rounded text size="small" @click.stop="handleDelete" />
      </div>
    </div>

    <div class="activity-content">
      <h3 class="activity-title">
        {{ activity.description }}
      </h3>

      <div v-if="activity.location" class="activity-location">
        <i class="pi pi-map-marker" style="font-size: x-small" />
        {{ activity.location }}
      </div>

      <div v-if="activity.links && activity.links.length" class="activity-links">
        <div class="links-label">
          Ссылки:
        </div>
        <div v-for="link in activity.links" :key="link" class="link-item">
          <i class="pi pi-link" style="font-size: x-small" />
          <a :href="link" target="_blank" rel="noopener">{{ link }}</a>
        </div>
      </div>

      <div v-if="activity.blocks && activity.blocks.length" class="activity-blocks">
        <div v-for="block in activity.blocks" :key="block.id" class="activity-block">
          <div class="block-header">
            <i :class="activityTypeIcons[block.type]" style="font-size: x-small" />
            <span class="block-title">{{ block.description }}</span>
          </div>
          <div v-if="block.notes" class="block-notes">
            {{ block.notes }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-item {
  margin-right: 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 8px;
  overflow: hidden;
  cursor: move;
  transition: box-shadow 0.2s ease;
  background-color: white;
  width: 100%;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.is-dragging {
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    opacity: 0.8;
  }

  .activity-header {
    display: flex;
    align-items: center;
    margin-bottom: 6px;

    .activity-icon {
      margin-right: 6px;
    }

    .activity-time {
      font-size: 12px;
      font-weight: 500;
      margin-right: auto;
    }

    .activity-actions {
      display: flex;
      gap: 4px;
    }
  }

  .activity-content {
    font-size: 13px;

    .activity-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .activity-location {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 4px;
    }

    .activity-links {
      margin-top: 6px;
      font-size: 12px;

      .links-label {
        font-weight: 500;
        margin-bottom: 2px;
      }

      .link-item {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 0;

        a {
          color: #1976d2;
          text-decoration: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          &:hover {
            text-decoration: underline;
          }
        }
      }
    }

    .activity-blocks {
      margin-top: 8px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      padding-top: 6px;

      .activity-block {
        padding: 4px 0;

        &:not(:last-child) {
          border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
          margin-bottom: 4px;
        }

        .block-header {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 2px;

          .block-title {
            font-weight: 500;
          }
        }

        .block-notes {
          font-size: 12px;
          color: rgba(0, 0, 0, 0.7);
          margin-left: 18px;
        }
      }
    }
  }
}
</style>
