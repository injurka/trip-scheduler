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

function getMemoryImageDate(meta: CustomImageViewerImageMeta, memory?: IMemory): Date | null {
  if (memory?.timestamp)
    return new Date(memory.timestamp)

  if (!meta.takenAt)
    return null

  const baseDate = new Date(meta.takenAt)

  if (!meta.timezoneOffset)
    return baseDate

  return new Date(baseDate.getTime() + meta.timezoneOffset * 60 * 1000)
}

function getMemoryActivityTitle(memoryId: string | undefined, groups?: any[]): string {
  if (!memoryId)
    return ''

  return groups?.find(group => group.memories.some((memory: IMemory) => memory.id === memoryId))?.title ?? ''
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

    return formatTime(activeViewerTime.value.hour, activeViewerTime.value.minute)
  })

  function openImageViewer() {
    if (props.isTimeEditing.value || !props.memory.image || props.isMorphed.value)
      return

    const imageList = props.galleryImages ?? []

    if (imageList.length === 0)
      return

    const startIndex = imageList.findIndex((img) => {
      const meta = img.meta as CustomImageViewerImageMeta | undefined

      return meta?.memoryId === props.memory.id
    })

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

    if (!meta?.memoryId || !activeViewerTime.value || !day || !day.date)
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
    if (!newImage?.meta)
      return

    const meta = newImage.meta as CustomImageViewerImageMeta
    activeViewerComment.value = newImage.caption || ''

    const memoryId = meta.memoryId
    const correspondingMemory = memoryId ? memories.memories.find((memory: IMemory) => memory.id === memoryId) : undefined
    const dateToUse = getMemoryImageDate(meta, correspondingMemory)

    activeViewerTime.value = dateToUse
      ? new Time(dateToUse.getUTCHours(), dateToUse.getUTCMinutes())
      : null
    activeViewerActivityTitle.value = getMemoryActivityTitle(memoryId, props.timelineGroups)
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
