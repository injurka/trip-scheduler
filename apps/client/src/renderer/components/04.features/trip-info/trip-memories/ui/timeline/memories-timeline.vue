<script setup lang="ts">
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import MemoriesTimelineGroup from './memories-timeline-group.vue'

interface Props {
  memories: IMemory[]
  isViewMode: boolean
  galleryImages: ImageViewerImage[]
  isFullScreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFullScreen: false,
})

const { ui } = useModuleStore(['ui'])

const timelineGroups = computed(() => {
  if (props.memories.length === 0)
    return []

  const groups: any[] = []
  let currentGroup: any = null

  const ensureStartGroup = () => {
    let startGroup = groups.find(g => g.type === 'start')
    if (!startGroup) {
      startGroup = {
        type: 'start',
        title: 'Начало дня',
        memories: [],
        activity: null,
      }
      groups.unshift(startGroup) 
    }
    return startGroup
  }

  for (const memory of props.memories) {
    if (memory.title) {
      currentGroup = {
        type: 'activity',
        activity: memory,
        title: memory.title,
        memories: [],
      }
      if (memory.imageId || memory.comment)
        currentGroup.memories.push(memory)

      groups.push(currentGroup)
    }
    else {
      if (currentGroup) {
        currentGroup.memories.push(memory)
      }
      else {
        const startGroup = ensureStartGroup()
        startGroup.memories.push(memory)
      }
    }
  }

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
      :is-full-screen="isFullScreen"
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
