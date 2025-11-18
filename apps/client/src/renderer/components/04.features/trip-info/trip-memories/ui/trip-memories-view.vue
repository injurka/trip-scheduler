<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitDivider } from '~/components/01.kit/kit-divider'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'
import MemoriesList from './list.vue'

const { ui, memories } = useModuleStore(['ui', 'memories'])
const { areAllMemoryGroupsCollapsed } = storeToRefs(ui)

const timelineGroups = computed(() => {
  const memoriesList = memories.memoriesForSelectedDay
  if (memoriesList.length === 0)
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
      groups.unshift(startGroup) // Add to the beginning
    }
    return startGroup
  }

  // Memories are already sorted by timestamp from the store
  for (const memory of memoriesList) {
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

const allMemoryGroupKeys = computed(() => timelineGroups.value.map(g => g.type + (g.activity?.id || g.title)))
const allMemoryBlocksCollapsed = computed(() => areAllMemoryGroupsCollapsed.value(allMemoryGroupKeys.value))
const collapseMemoriesIcon = computed(() =>
  allMemoryBlocksCollapsed.value ? 'mdi:chevron-double-down' : 'mdi:chevron-double-up',
)
function handleToggleAllMemories() {
  ui.toggleAllMemoryGroups(allMemoryGroupKeys.value)
}
</script>

<template>
  <div class="memories-view">
    <div class="divider-with-action">
      <KitDivider
        :is-loading="memories.isLoadingMemories || memories.isCreatingMemory"
      >
        воспоминания дня
      </KitDivider>
      <button
        v-if="allMemoryGroupKeys.length > 0"
        class="collapse-all-btn"
        title="Свернуть/развернуть все группы"
        @click="handleToggleAllMemories"
      >
        <Icon :icon="collapseMemoriesIcon" />
      </button>
    </div>

    <MemoriesList />
  </div>
</template>

<style scoped lang="scss">
.divider-with-action {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 16px;

  .kit-divider {
    flex-grow: 1;
  }

  .collapse-all-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-s);
    color: var(--fg-secondary-color);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.1rem;
    transition: all 0.2s ease;
    z-index: 1;

    &:hover {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      background-color: var(--bg-hover-color);
    }
  }
}
</style>
