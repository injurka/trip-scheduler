import type { ChecklistGroup, ChecklistItem, ChecklistPriority, ChecklistSectionContent, ChecklistTab } from '../models/types'
import { useDebounceFn } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

interface UseChecklistSectionProps {
  section: {
    id: string
    type: 'checklist'
    content: ChecklistSectionContent
  }
  readonly: boolean
}

/**
 * Хук для управления логикой секции чек-листа.
 * @param props - Входящие параметры компонента.
 * @param emit - Функция для отправки событий.
 */
export function useChecklistSection(
  props: UseChecklistSectionProps,
  emit: (event: 'updateSection', payload: any) => void,
) {
  const confirm = useConfirm()

  // --- Локальное состояние ---
  const initialItems = (props.section.content?.items || []).map((item: any): ChecklistItem => {
    let priority: ChecklistPriority = 1
    if (item.priority === 'high') {
      priority = 4
    }
    else if (item.priority === 'normal') {
      priority = 1
    }
    else if (typeof item.priority === 'number' && item.priority >= 1 && item.priority <= 5) {
      priority = item.priority
    }
    return {
      ...item,
      priority,
    }
  })

  const items = ref<ChecklistItem[]>(JSON.parse(JSON.stringify(initialItems)))
  const groups = ref<ChecklistGroup[]>(JSON.parse(JSON.stringify(props.section.content?.groups || [])))
  const activeTab = ref<ChecklistTab>('preparation')

  // --- Состояния для UI ---
  const hideCompleted = ref(false)
  const searchQuery = ref('')

  const tabItems = [
    { id: 'preparation', label: 'Подготовка', icon: 'mdi:briefcase-check-outline' },
    { id: 'in-trip', label: 'В путешествии', icon: 'mdi:map-marker-path' },
  ]

  // --- Логика ---
  const debouncedUpdate = useDebounceFn(() => {
    emit('updateSection', {
      ...props.section,
      content: { items: items.value, groups: groups.value },
    })
  }, 700)

  // --- Управление элементами ---
  function addItem(text: string, tab: ChecklistTab, groupId: string | null = null) {
    if (props.readonly || !text.trim())
      return

    items.value.unshift({
      id: uuidv4(),
      text,
      completed: false,
      type: tab,
      groupId,
      priority: 1, // Приоритет по умолчанию - "Без приоритета"
    })
  }

  function deleteItem(id: string) {
    if (props.readonly)
      return
    items.value = items.value.filter(item => item.id !== id)
  }

  function updateItem(updatedItem: ChecklistItem) {
    if (props.readonly)
      return
    const index = items.value.findIndex(i => i.id === updatedItem.id)
    if (index !== -1)
      items.value[index] = updatedItem
  }

  // --- Управление группами ---
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

  // --- Вычисляемые свойства (ДОРАБОТАНЫ) ---
  const filteredItems = computed(() => {
    let result = items.value.filter(item => item.type === activeTab.value)

    if (hideCompleted.value)
      result = result.filter(item => !item.completed)

    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(item =>
        item.text.toLowerCase().includes(query)
        || (item.description && item.description.toLowerCase().includes(query)),
      )
    }

    return result
  })

  const itemsByGroupId = computed(() => {
    return filteredItems.value.reduce((acc, item) => {
      if (item.groupId) {
        if (!acc[item.groupId])
          acc[item.groupId] = []
        acc[item.groupId].push(item)
      }
      return acc
    }, {} as Record<string, ChecklistItem[]>)
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

  watch([items, groups], () => {
    debouncedUpdate()
  }, { deep: true })

  return {
    items,
    groups,
    activeTab,
    tabItems,
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
    addGroup,
    deleteGroup,
    updateGroup,
  }
}
