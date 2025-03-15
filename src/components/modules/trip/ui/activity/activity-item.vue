<script setup lang="ts">
import type { Activity } from '~/components/modules/trip/models/activity'
import { activityTypeIcons } from '~/components/modules/trip/models/activity'
import { MarkdownContent } from '~/components/shared/markdown-content'

interface ActivityItemProps {
  activity: Activity
}

defineProps<ActivityItemProps>()
</script>

<template>
  <div class="activity-item">
    <div class="activity-header">
      <div class="activity-time">
        {{ activity.startTime }} - {{ activity.endTime }}
      </div>
    </div>

    <div class="activity-content">
      <h3 class="activity-title">
        {{ activity.description }}
      </h3>

      <div v-if="activity.blocks && activity.blocks.length" class="activity-blocks">
        <div v-for="block in activity.blocks" :key="block.id" class="activity-block">
          <div v-if="block.type" class="block-header">
            <i :class="activityTypeIcons[block.type]" style="font-size: x-small" />
          </div>
          <MarkdownContent
            class="block-description"
            :content="block.description"
          />
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

  &:hover {
    .activity-content {
      box-shadow: 0 2px 8px var(--border-secondary-color);
    }
  }

  .activity-header {
    display: flex;
    align-items: center;

    .activity-time {
      position: relative;
      line-height: normal;
      font-weight: 600;
      margin-right: auto;
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
        cursor: pointer;
      }
    }
  }

  .activity-content {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 8px;
    transition: box-shadow 0.2s ease;
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
      width: 1px;
      background-color: var(--border-secondary-color);
    }

    .activity-title {
      font-size: 1rem;
      font-weight: 400;
      margin: 0;
      margin-bottom: 4px;
    }

    .activity-blocks {
      margin-top: 8px;
      border-top: 1px solid var(--border-secondary-color);
      padding-top: 6px;

      .activity-block {
        &:not(:last-child) {
          border-bottom: 1px dashed var(--border-secondary-color);
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

        .block-description {
          font-size: 0.9rem;
          color: var(--fg-primary-color);
          &:deep() {
            > p {
              padding: 0;
              margin: 0;
            }
          }
        }
      }
    }
  }
}
</style>
