<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import { computed } from 'vue'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import MemoriesTimelineGroup from './memories-timeline-group.vue'

interface Props {
  memories: IMemory[]
  isViewMode: boolean
  galleryImages: ImageViewerImage[]
}

const props = defineProps<Props>()

const { ui } = useModuleStore(['ui'])

const timelineGroups = computed(() => {
  if (props.memories.length === 0)
    return []

  const groups: any[] = []
  let currentGroup: any = null

  // Helper function to create a "start of day" group if it doesn't exist
  const ensureStartGroup = () => {
    let startGroup = groups.find(g => g.type === 'start')
    if (!startGroup) {
      startGroup = {
        type: 'start',
        title: 'Начало дня',
        memories: [],
        activity: null,
      }
      groups.unshift(startGroup) // Add to the beginning
    }
    return startGroup
  }

  // Memories are already sorted by timestamp from the store
  for (const memory of props.memories) {
    if (memory.title) {
      // This is an activity-like memory, it starts a new group
      currentGroup = {
        type: 'activity',
        activity: memory, // The memory itself provides the group's data
        title: memory.title,
        memories: [], // Child memories (photos/notes) will be added here
      }
      // An activity can also be a photo or have a comment, so we add it to its own items.
      if (memory.imageId || memory.comment)
        currentGroup.memories.push(memory)

      groups.push(currentGroup)
    }
    else {
      // This is a simple photo or note memory
      if (currentGroup) {
        // Add it to the last known activity group
        currentGroup.memories.push(memory)
      }
      else {
        // No activity has occurred yet, add to the "Start of Day" group
        const startGroup = ensureStartGroup()
        startGroup.memories.push(memory)
      }
    }
  }

  // Clean up empty start group if no items were added before the first activity
  const startGroup = groups.find(g => g.type === 'start')
  if (startGroup && startGroup.memories.length === 0)
    return groups.filter(g => g.type !== 'start')

  return groups
})
</script>

<template>
  <div class="timeline-section">
    <MemoriesTimelineGroup
      v-for="group in timelineGroups"
      :key="group.type + (group.activity?.id || group.title)"
      :group="group"
      :is-view-mode="isViewMode"
      :gallery-images="galleryImages"
      :timeline-groups="timelineGroups"
      :is-collapsed="ui.collapsedMemoryGroups.has(group.type + (group.activity?.id || group.title))"
      @toggle-collapse="ui.toggleMemoryGroupCollapsed(group.type + (group.activity?.id || group.title))"
    />
  </div>
</template>

<style scoped lang="scss">
.timeline-section {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}
</style>
