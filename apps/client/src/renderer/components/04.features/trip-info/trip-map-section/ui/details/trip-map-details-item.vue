<script setup lang="ts">
import type { Activity, ActivitySection } from '~/shared/types/models/activity'
import { Icon } from '@iconify/vue'
import { getTagInfo } from '~/components/05.modules/trip-info/lib/helpers'
import SectionRenderer from './trip-map-details-section-renderer.vue'

interface Props {
  activity: Activity
}
const props = defineProps<Props>()

const tagInfo = computed(() => getTagInfo(props.activity.tag))

// Группировка секций, аналогично trip-plan/item.vue
const sectionGroups = computed(() => {
  const groups: { parent: ActivitySection, children: ActivitySection[] }[] = []
  const sections = (props.activity.sections || [])
  let i = 0

  while (i < sections.length) {
    const currentSection = sections[i]

    if (!currentSection.isAttached) {
      const attachedChildren: ActivitySection[] = []
      let j = i + 1

      while (j < sections.length && sections[j].isAttached) {
        attachedChildren.push(sections[j])
        j++
      }
      groups.push({ parent: currentSection, children: attachedChildren })
      i = j
    }
    else {
      groups.push({ parent: currentSection, children: [] })
      i++
    }
  }
  return groups
})
</script>

<template>
  <div class="activity-item-details">
    <div class="activity-header">
      <div class="activity-time">
        {{ activity.startTime }} - {{ activity.endTime }}
      </div>

      <div v-if="tagInfo" class="tag-chip" :style="{ backgroundColor: tagInfo.color }">
        <Icon :icon="tagInfo.icon" />
        <span class="tag-chip-label">{{ tagInfo.label }}</span>
      </div>
    </div>
    <div class="activity-title">
      <Icon icon="mdi:chevron-right" />
      <div class="activity-title-text">
        {{ activity.title }}
      </div>
    </div>
    <div class="activity-sections">
      <div v-if="sectionGroups.length > 0" class="sections-list">
        <div
          v-for="group in sectionGroups"
          :key="group.parent.id"
          class="section-group"
        >
          <SectionRenderer :section="group.parent" />
          <!-- Children sections are not rendered in this simplified view -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-item-details {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
}
.activity-header {
  display: flex;
  align-items: center;
  gap: 16px;
}
.activity-time {
  font-weight: 600;
  color: var(--fg-accent-color);
}
.tag-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: var(--r-full);
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-primary-color);
  line-height: 24px;
}
.activity-title {
  display: flex;
  margin-top: 4px;
  gap: 4px;
  .iconify {
    height: 24px;
    opacity: 0.5;
    color: var(--fg-secondary-color);
  }
}
.activity-title-text {
  width: 100%;
  font-weight: 500;
  font-size: 1.1rem;
  padding: 4px 0;
}
.activity-sections {
  margin-top: 12px;
  padding-left: 8px;
}
.sections-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
