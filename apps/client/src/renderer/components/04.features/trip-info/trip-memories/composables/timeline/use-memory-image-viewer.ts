import type { Ref } from 'vue'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { CustomImageViewerImageMeta } from '~/components/05.modules/trip-info/lib/helpers'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import { Time } from '@internationalized/date'
import { useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { useModuleStore } from '~/components/05.modules/trip-info/composables/use-trip-info-module'

interface UseMemoryImageViewerProps {
  memory: IMemory
  galleryImages: ImageViewerImage[]
  timelineGroups: any[]
  isTimeEditing: Ref<boolean>
  isMorphed: Ref<boolean>
}

export function useMemoryImageViewer(props: UseMemoryImageViewerProps) {
  const { memories, plan } = useModuleStore(['memories', 'plan'])
  const { updateMemory } = memories
  const { getSelectedDay } = storeToRefs(plan)

  const imageViewer = useImageViewer()
  const activeViewerComment = ref('')
  const activeViewerActivityTitle = ref('')
  const activeViewerTime = shallowRef<Time | null>(null)

  const formattedActiveViewerTime = computed(() => {
    if (!activeViewerTime.value)
      return ''
    
    const hours = String(activeViewerTime.value.hour).padStart(2, '0')
    const minutes = String(activeViewerTime.value.minute).padStart(2, '0')

    return `${hours}:${minutes}`
  })

  function openImageViewer() {
    if (props.isTimeEditing.value || !props.memory.image || props.isMorphed.value)
      return

    const imageList = props.galleryImages ?? []
    if (imageList.length === 0)
      return

    const startIndex = imageList.findIndex(img => img.url === props.memory.image?.url)
    if (startIndex !== -1)
      imageViewer.open(imageList, startIndex)
  }

  function saveViewerComment() {
    const meta = imageViewer.currentImage.value?.meta as CustomImageViewerImageMeta | undefined
    if (meta?.memoryId) {
      const originalMemory = memories.memories.find((m: IMemory) => m.id === meta.memoryId)
      if (originalMemory && activeViewerComment.value !== (originalMemory.comment || ''))
        updateMemory({ id: meta.memoryId, comment: activeViewerComment.value })
    }
  }

  function saveViewerTime() {
    const meta = imageViewer.currentImage.value?.meta as CustomImageViewerImageMeta | undefined
    const day = getSelectedDay.value
    if (!meta?.memoryId || !activeViewerTime.value || !day)
      return

    const originalMemory = memories.memories.find((m: IMemory) => m.id === meta.memoryId)
    if (!originalMemory)
      return

    const datePart = day.date.split('T')[0]
    const timePart = `${activeViewerTime.value.hour.toString().padStart(2, '0')}:${activeViewerTime.value.minute.toString().padStart(2, '0')}:00`
    const newTimestamp = `${datePart}T${timePart}.000Z`

    if (newTimestamp !== originalMemory.timestamp)
      updateMemory({ id: meta.memoryId, timestamp: newTimestamp })
  }

  watch(imageViewer.currentImage, (newImage) => {
    if (newImage?.meta) {
      const meta = newImage.meta as CustomImageViewerImageMeta
      activeViewerComment.value = newImage.caption || ''

      const memoryId = meta.memoryId
      const correspondingMemory = memoryId ? memories.memories.find((m: IMemory) => m.id === memoryId) : undefined

      let dateToUse: Date | null = null
      if (correspondingMemory?.timestamp) {
        dateToUse = new Date(correspondingMemory.timestamp)
      }
      else if (meta.takenAt) {
        const baseDate = new Date(meta.takenAt)
        if (meta.timezoneOffset) {
          const localTimeMs = baseDate.getTime() + meta.timezoneOffset * 60 * 1000
          dateToUse = new Date(localTimeMs)
        }
        else {
          dateToUse = baseDate
        }
      }

      if (dateToUse)
        activeViewerTime.value = new Time(dateToUse.getUTCHours(), dateToUse.getUTCMinutes())
      else
        activeViewerTime.value = null

      if (memoryId) {
        const group = props.timelineGroups?.find(g => g.memories.some((m: IMemory) => m.id === memoryId))
        activeViewerActivityTitle.value = group ? group.title : ''
      }
      else {
        activeViewerActivityTitle.value = ''
      }
    }
  }, { deep: true })

  return {
    imageViewer,
    activeViewerComment,
    activeViewerActivityTitle,
    activeViewerTime,
    formattedActiveViewerTime,
    openImageViewer,
    saveViewerComment,
    saveViewerTime,
  }
}
