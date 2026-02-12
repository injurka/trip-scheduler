import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import { Time } from '@internationalized/date'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

export function useMemoryItemActions(props: { memory: IMemory, isViewMode: boolean }) {
  const confirm = useConfirm()
  const { memories, plan } = useModuleStore(['memories', 'plan'])

  const { updateMemory, deleteMemory, removeTimestamp } = memories
  const { getSelectedDay } = storeToRefs(plan)

  const memoryComment = ref(props.memory.comment || '')
  const isTimeEditing = ref(false)

  const editingTime = shallowRef<Time | null>(null)

  const displayTime = computed(() => {
    if (!props.memory.timestamp)
      return ''

    const d = new Date(props.memory.timestamp)
    const hours = d.getUTCHours().toString().padStart(2, '0')
    const minutes = d.getUTCMinutes().toString().padStart(2, '0')
    const formattedTime = `${hours}:${minutes}`

    if (props.memory.title)
      return ''
    if (formattedTime === '00:00')
      return ''
    return formattedTime
  })

  function handleTimeClick() {
    if (props.isViewMode)
      return
    isTimeEditing.value = true
    if (props.memory.timestamp) {
      const d = new Date(props.memory.timestamp)
      editingTime.value = new Time(d.getUTCHours(), d.getUTCMinutes())
    }
    else {
      editingTime.value = new Time()
    }
  }

  function saveTime() {
    if (!isTimeEditing.value || !editingTime.value || !getSelectedDay.value)
      return

    const datePart = getSelectedDay.value.date.split('T')[0]
    const timePart = `${editingTime.value.hour.toString().padStart(2, '0')}:${editingTime.value.minute.toString().padStart(2, '0')}:00`
    const newTimestamp = `${datePart}T${timePart}.000Z`

    updateMemory({ id: props.memory.id, timestamp: newTimestamp })
    isTimeEditing.value = false
  }

  function saveComment() {
    if (memoryComment.value !== props.memory.comment)
      updateMemory({ id: props.memory.id, comment: memoryComment.value })
  }

  function saveRating(rating: number) {
    if (props.isViewMode)
      return

    const newRating = props.memory.rating === rating ? null : rating
    updateMemory({ id: props.memory.id, rating: newRating })
  }

  async function handleDelete() {
    const isConfirmed = await confirm({
      title: 'Удалить воспоминание?',
      description: 'Это действие нельзя будет отменить. Воспоминание будет удалено навсегда.',
    })

    if (isConfirmed)
      await deleteMemory(props.memory.id)
  }

  async function handleRemoveTimestamp() {
    const isConfirmed = await confirm({
      title: 'Убрать временную метку?',
      description: 'Воспоминание будет перемещено в блок "Фотографии для обработки".',
    })

    if (isConfirmed)
      removeTimestamp(props.memory.id)
  }

  return {
    memoryComment,
    saveComment,
    saveRating,
    isTimeEditing,
    editingTime,
    displayTime,
    handleTimeClick,
    saveTime,
    handleDelete,
    handleRemoveTimestamp,
  }
}
