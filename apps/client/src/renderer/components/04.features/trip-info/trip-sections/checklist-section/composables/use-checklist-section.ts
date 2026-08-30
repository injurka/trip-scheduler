import type {
  ChecklistGroup,
  ChecklistItem,
  ChecklistPreset,
  ChecklistPriority,
  ChecklistSectionContent,
  ChecklistSubtask,
  ChecklistTab,
  ChecklistTabConfig,
} from '../models/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useTripPermissions } from '~/components/05.modules/trip-info/composables/use-trip-permissions'

interface UseChecklistSectionProps {
  section: {
    id: string
    type: 'checklist'
    content: ChecklistSectionContent
  }
  readonly: boolean
}

const DEFAULT_TABS: ChecklistTabConfig[] = [
  { id: 'preparation', name: 'Подготовка', icon: 'mdi:briefcase-check-outline', isCustom: false },
  { id: 'in-trip', name: 'В путешествии', icon: 'mdi:map-marker-path', isCustom: false },
]

/**
 * Хук для управления логикой секции чек-листа с поддержкой кастомных вкладок, подзадач и импорта.
 */
export function useChecklistSection(
  props: UseChecklistSectionProps,
  emit: (event: 'updateSection', payload: any) => void,
) {
  const confirm = useConfirm()
  const toast = useToast()
  const { canEdit } = useTripPermissions()

  // Инициализация вкладок
  const initialTabs = (props.section.content?.tabs && props.section.content.tabs.length > 0)
    ? props.section.content.tabs
    : DEFAULT_TABS

  const tabs = ref<ChecklistTabConfig[]>(JSON.parse(JSON.stringify(initialTabs)))

  // Инициализация элементов
  const initialItems = (props.section.content?.items || []).map((item: any): ChecklistItem => {
    let priority: ChecklistPriority = 1
    if (item.priority === 'high') {
      priority = 4
    }
    else if (item.priority === 'normal') {
      priority = 1
    }
    else if (typeof item.priority === 'number' && item.priority >= 1 && item.priority <= 5) {
      priority = item.priority as ChecklistPriority
    }

    return {
      ...item,
      priority,
      subtasks: item.subtasks || [],
    }
  })

  const items = ref<ChecklistItem[]>(JSON.parse(JSON.stringify(initialItems)))
  const groups = ref<ChecklistGroup[]>(JSON.parse(JSON.stringify(props.section.content?.groups || [])))
  const activeTab = ref<ChecklistTab>(tabs.value[0]?.id || 'preparation')

  const hideCompleted = ref(false)
  const searchQuery = ref('')

  const debouncedUpdate = useDebounceFn(() => {
    emit('updateSection', {
      ...props.section,
      content: {
        items: items.value,
        groups: groups.value,
        tabs: tabs.value,
      },
    })
  }, 400)

  // Вкладки
  const tabItems = computed(() => {
    return tabs.value.map(t => ({
      id: t.id,
      label: t.name,
      icon: t.icon,
    }))
  })

  const currentTabConfig = computed(() => {
    return tabs.value.find(t => t.id === activeTab.value) || tabs.value[0]
  })

  function addTab(newTab: { id: string, name: string, icon: string }) {
    if (props.readonly || !newTab.name.trim())
      return
    tabs.value.push({
      ...newTab,
      isCustom: true,
    })
    activeTab.value = newTab.id
    toast.success(`Вкладка «${newTab.name}» создана`)
    debouncedUpdate()
  }

  function updateTab(updatedTab: { id: string, name: string, icon: string }) {
    if (props.readonly)
      return
    const idx = tabs.value.findIndex(t => t.id === updatedTab.id)
    if (idx !== -1) {
      tabs.value[idx] = {
        ...tabs.value[idx],
        name: updatedTab.name,
        icon: updatedTab.icon,
      }
      debouncedUpdate()
    }
  }

  async function deleteTab(tabId: string) {
    if (props.readonly)
      return

    const targetTab = tabs.value.find(t => t.id === tabId)
    if (!targetTab)
      return

    const hasContent = items.value.some(i => i.type === tabId) || groups.value.some(g => g.type === tabId)

    if (hasContent) {
      const isConfirmed = await confirm({
        title: `Удалить вкладку «${targetTab.name}»?`,
        description: 'Все группы и задачи внутри этой вкладки будут удалены. Это действие необратимо.',
        confirmText: 'Удалить',
        type: 'danger',
      })
      if (!isConfirmed)
        return
    }

    tabs.value = tabs.value.filter(t => t.id !== tabId)
    groups.value = groups.value.filter(g => g.type !== tabId)
    items.value = items.value.filter(i => i.type !== tabId)

    if (activeTab.value === tabId) {
      activeTab.value = tabs.value[0]?.id || 'preparation'
    }

    toast.info(`Вкладка «${targetTab.name}» удалена`)
    debouncedUpdate()
  }

  // Задачи
  function addItem(text: string, tab: ChecklistTab, groupId: string | null = null) {
    if (props.readonly || !text.trim())
      return

    items.value.unshift({
      id: uuidv4(),
      text,
      completed: false,
      type: tab,
      groupId,
      priority: 1,
      subtasks: [],
    })
  }

  function deleteItem(id: string) {
    if (props.readonly)
      return
    items.value = items.value.filter(item => item.id !== id)
  }

  function updateItem(updatedItem: ChecklistItem) {
    if (props.readonly && !canEdit.value)
      return
    const index = items.value.findIndex(i => i.id === updatedItem.id)
    if (index !== -1) {
      items.value[index] = updatedItem
      debouncedUpdate()
    }
  }

  // Подзадачи (Subtasks)
  function addSubtask(itemId: string, text: string) {
    if (props.readonly || !text.trim())
      return
    const item = items.value.find(i => i.id === itemId)
    if (item) {
      if (!item.subtasks)
        item.subtasks = []
      item.subtasks.push({
        id: uuidv4(),
        text: text.trim(),
        completed: false,
      })
      debouncedUpdate()
    }
  }

  function toggleSubtask(itemId: string, subtaskId: string, completed?: boolean) {
    if (props.readonly && !canEdit.value)
      return
    const item = items.value.find(i => i.id === itemId)
    if (item && item.subtasks) {
      const subtask = item.subtasks.find(s => s.id === subtaskId)
      if (subtask) {
        subtask.completed = completed !== undefined ? completed : !subtask.completed
        debouncedUpdate()
      }
    }
  }

  function deleteSubtask(itemId: string, subtaskId: string) {
    if (props.readonly)
      return
    const item = items.value.find(i => i.id === itemId)
    if (item && item.subtasks) {
      item.subtasks = item.subtasks.filter(s => s.id !== subtaskId)
      debouncedUpdate()
    }
  }

  // Группы
  function addGroup(tab: ChecklistTab) {
    if (props.readonly)
      return
    groups.value.unshift({
      id: uuidv4(),
      name: 'Новая группа',
      icon: 'mdi:tag-outline',
      type: tab,
    })
  }

  async function deleteGroup(id: string) {
    if (props.readonly)
      return

    const isConfirmed = await confirm({
      title: 'Удалить группу?',
      description: 'Все задачи внутри этой группы также будут удалены. Это действие необратимо.',
      confirmText: 'Удалить',
      type: 'danger',
    })

    if (isConfirmed) {
      groups.value = groups.value.filter(g => g.id !== id)
      items.value = items.value.filter(item => item.groupId !== id)
    }
  }

  function updateGroup(updatedGroup: ChecklistGroup) {
    if (props.readonly)
      return
    const index = groups.value.findIndex(g => g.id === updatedGroup.id)
    if (index !== -1)
      groups.value[index] = updatedGroup
  }

  // Пресеты
  function applyPreset(preset: ChecklistPreset) {
    if (props.readonly)
      return

    preset.groups.forEach((groupData) => {
      const newGroupId = uuidv4()

      groups.value.push({
        id: newGroupId,
        name: groupData.name,
        icon: groupData.icon,
        type: activeTab.value,
      })

      groupData.items.forEach((itemData) => {
        const subtasks: ChecklistSubtask[] = (itemData.subtasks || []).map(s => ({
          id: uuidv4(),
          text: s,
          completed: false,
        }))

        items.value.push({
          id: uuidv4(),
          text: itemData.text,
          completed: false,
          type: activeTab.value,
          groupId: newGroupId,
          priority: itemData.priority || 1,
          description: itemData.description,
          cost: itemData.cost,
          link: itemData.link,
          subtasks,
        })
      })
    })

    toast.success(`Пресет «${preset.name}» добавлен`)
    debouncedUpdate()
  }

  // Фильтрация
  const filteredItems = computed(() => {
    let result = items.value.filter(item => item.type === activeTab.value)

    if (hideCompleted.value)
      result = result.filter(item => !item.completed)

    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(item =>
        item.text.toLowerCase().includes(query)
        || (item.description && item.description.toLowerCase().includes(query))
        || (item.cost && item.cost.toLowerCase().includes(query))
        || (item.location && item.location.toLowerCase().includes(query))
        || (item.subtasks && item.subtasks.some(s => s.text.toLowerCase().includes(query))),
      )
    }

    return result
  })

  const itemsByGroupId = computed(() => {
    const map: Record<string, ChecklistItem[]> = {}
    const list = filteredItems.value
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (item.groupId) {
        if (!map[item.groupId])
          map[item.groupId] = []
        map[item.groupId].push(item)
      }
    }
    return map
  })

  const currentTabGroups = computed(() => {
    return groups.value.filter((group) => {
      if (group.type !== activeTab.value)
        return false

      const search = searchQuery.value.trim().toLowerCase()
      if (search) {
        const nameMatchesSearch = group.name.toLowerCase().includes(search)
        const hasVisibleItems = (itemsByGroupId.value[group.id] || []).length > 0
        return nameMatchesSearch || hasVisibleItems
      }

      return true
    })
  })

  const currentTabUngroupedItems = computed(() => filteredItems.value.filter(item => !item.groupId))

  const progress = computed(() => {
    const relevantItems = items.value.filter(item => item.type === activeTab.value)
    const total = relevantItems.length
    if (total === 0)
      return 0
    const completed = relevantItems.filter(item => item.completed).length
    return Math.round((completed / total) * 100)
  })

  const hasItemsInCurrentTab = computed(() => {
    return items.value.some(item => item.type === activeTab.value)
  })

  watch([items, groups, tabs], () => {
    debouncedUpdate()
  }, { deep: true })

  return {
    items,
    groups,
    tabs,
    activeTab,
    tabItems,
    currentTabConfig,
    progress,
    hideCompleted,
    searchQuery,
    currentTabGroups,
    currentTabUngroupedItems,
    itemsByGroupId,
    hasItemsInCurrentTab,
    addItem,
    deleteItem,
    updateItem,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addGroup,
    deleteGroup,
    updateGroup,
    addTab,
    updateTab,
    deleteTab,
    applyPreset,
  }
}
