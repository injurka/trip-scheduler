import type { ComputedRef, Ref } from 'vue'
import type { ImageViewerImage } from '~/components/01.kit/kit-image-viewer'
import type { CustomImageViewerImageMeta } from '~/components/05.modules/trip-info/lib/helpers'
import type { IMemory } from '~/components/05.modules/trip-info/models/types'
import { Time } from '@internationalized/date'
import { useImageViewer } from '~/components/01.kit/kit-image-viewer'
import { useModuleStore } from '~/components/05.modules/trip-info'

interface UseSharedMemoryViewerProps {
  galleryImages: Ref<ImageViewerImage[]> | ComputedRef<ImageViewerImage[]>
  timelineGroups: Ref<any[]> | ComputedRef<any[]>
}

export function useSharedMemoryViewer(props: UseSharedMemoryViewerProps) {
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

  function openImageViewer(memory: IMemory) {
    if (!memory.image)
      return
    const imageList = props.galleryImages.value ?? []
    if (!imageList.length)
      return
    const startIndex = imageList.findIndex((img) => {
      const meta = img.meta as CustomImageViewerImageMeta | undefined
      return meta?.memoryId === memory.id
    })
    if (startIndex !== -1)
      imageViewer.open(imageList, startIndex)
  }

  function saveViewerComment() {
    const meta = imageViewer.currentImage.value?.meta as CustomImageViewerImageMeta | undefined
    if (meta?.memoryId) {
      const original = memories.memories.find((m: IMemory) => m.id === meta.memoryId)
      if (original && activeViewerComment.value !== original.comment)
        updateMemory({ id: meta.memoryId, comment: activeViewerComment.value })
    }
  }

  function saveViewerTime() {
    const meta = imageViewer.currentImage.value?.meta as CustomImageViewerImageMeta | undefined
    const day = getSelectedDay.value
    if (!meta?.memoryId || !activeViewerTime.value || !day)
      return
    const original = memories.memories.find((m: IMemory) => m.id === meta.memoryId)
    if (!original)
      return
    const datePart = day.date.split('T')[0]
    const h = activeViewerTime.value.hour.toString().padStart(2, '0')
    const m = activeViewerTime.value.minute.toString().padStart(2, '0')
    const newTimestamp = `${datePart}T${h}:${m}:00.000Z`
    if (newTimestamp !== original.timestamp)
      updateMemory({ id: meta.memoryId, timestamp: newTimestamp })
  }

  watch(imageViewer.currentImage, (newImage) => {
    if (!newImage?.meta)
      return
    const meta = newImage.meta as CustomImageViewerImageMeta
    activeViewerComment.value = newImage.caption ?? ''

    const memoryId = meta.memoryId
    const correspondingMemory = memoryId
      ? memories.memories.find((m: IMemory) => m.id === memoryId)
      : undefined

    let dateToUse: Date | null = null
    if (correspondingMemory?.timestamp) {
      dateToUse = new Date(correspondingMemory.timestamp)
    }
    else if (meta.takenAt) {
      const base = new Date(meta.takenAt)
      dateToUse = meta.timezoneOffset
        ? new Date(base.getTime() + meta.timezoneOffset * 60 * 1000)
        : base
    }

    activeViewerTime.value = dateToUse
      ? new Time(dateToUse.getUTCHours(), dateToUse.getUTCMinutes())
      : null

    if (memoryId) {
      const group = props.timelineGroups.value?.find((g: any) =>
        g.memories.some((m: IMemory) => m.id === memoryId),
      )
      activeViewerActivityTitle.value = group?.title ?? ''
    }
    else {
      activeViewerActivityTitle.value = ''
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
