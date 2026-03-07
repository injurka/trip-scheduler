import type { MaybeRefOrGetter } from 'vue'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import { Time } from '@internationalized/date'
import { toValue } from 'vue'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

export function useMemoryItemActions(props: {
  memory: IMemory
  isViewMode: MaybeRefOrGetter<boolean>
}) {
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

    if (props.memory.title)
      return ''

    const formatted = formatTimestamp(props.memory.timestamp)

    return formatted === '00:00' ? '' : formatted
  })

  function handleTimeClick() {
    if (toValue(props.isViewMode))
      return

    isTimeEditing.value = true

    if (props.memory.timestamp) {
      editingTime.value = getTimeFromTimestamp(props.memory.timestamp)
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
    if (toValue(props.isViewMode))
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
