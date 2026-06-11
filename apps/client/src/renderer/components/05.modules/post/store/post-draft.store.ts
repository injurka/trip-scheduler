import type {
  CreatePostInput,
  PostDetail,
  PostMedia,
  TimelineBlock,
  TimelineBlockType,
  TimelineStage,
  UpdatePostInput,
} from '~/shared/types/models/post'
import type { TripImage } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { toRaw } from 'vue'
import { useRequest } from '~/plugins/request'
import { useToast } from '~/shared/composables/use-toast'
import { EPostRequestKeys } from './post.store'

type ClientPostMedia = PostMedia & { file?: File }

export interface AiGeneratedBlock {
  type: 'text' | 'location' | 'route'
  content?: string | null
  name?: string | null
  address?: string | null
  coords?: { lat: number, lng: number } | null
  from?: string | null
  to?: string | null
  transport?: 'walk' | 'transit' | 'car' | null
  distance?: string | null
  duration?: string | null
}

export interface AiGeneratedStage {
  title?: string | null
  day?: number | null
  time?: string | null
  blocks?: AiGeneratedBlock[] | null
}

export interface AiGeneratedPostData {
  title?: string | null
  insight?: string | null
  description?: string | null
  country?: string | null
  tags?: string[] | null
  stages?: AiGeneratedStage[] | null
}

function defaultPostState(): PostDetail {
  return {
    id: uuidv4(),
    title: '',
    insight: '',
    city: '',
    country: '',
    latitude: 0,
    longitude: 0,
    startDate: '',
    tags: [],
    media: [],
    elements: [],
    statsDetail: { views: 0, duration: 0 },
    stages: [
      { id: uuidv4(), day: 1, time: '', title: 'Начало', order: 0, blocks: [] } as unknown as TimelineStage,
    ],
    user: { id: '', name: '', avatarUrl: '' },
    stats: { likes: 0, saves: 0, isLiked: false, isSaved: false },
    createdAt: new Date().toISOString(),
    description: '',
    status: 'draft',
  }
}

function isClientMedia(media: PostMedia | ClientPostMedia): media is ClientPostMedia {
  return 'file' in media && media.file instanceof File
}

/**
 * Локальное сжатие изображений для предпросмотра без зависания UI
 */
function generateThumbnail(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob))
          }
          else {
            resolve(url)
          }
          canvas.width = 0
          canvas.height = 0
        }, 'image/jpeg', 0.8)
      }
      else {
        resolve(url)
      }
      URL.revokeObjectURL(url)
    }
    img.onerror = () => resolve(url)
    img.src = url
  })
}

export const usePostDraftStore = defineStore('post-draft', {
  state: () => ({
    post: defaultPostState() as PostDetail,
    isDirty: false,
    isSaving: false,
    createdServerId: null as string | null,
    isNewPost: true,
  }),

  actions: {
    initDraft(existingPost?: PostDetail, isNew?: boolean) {
      if (existingPost) {
        this.post = JSON.parse(JSON.stringify(existingPost))
        if (!this.post.statsDetail) {
          this.post.statsDetail = { views: 0, duration: 0 }
        }
        if (!this.post.stages) {
          this.post.stages = []
        }
      }
      else {
        this.post = defaultPostState()
      }

      this.isNewPost = isNew !== undefined ? isNew : !existingPost
      this.createdServerId = this.isNewPost ? null : this.post.id
      this.isDirty = false
    },

    async ensurePostCreated() {
      if (this.createdServerId)
        return this.createdServerId
      if (!this.isNewPost)
        return this.post.id

      const payload: CreatePostInput = {
        title: this.post.title || 'Новый маршрут',
        insight: this.post.insight || undefined,
        description: this.post.description || undefined,
        country: this.post.country || undefined,
        startDate: this.post.startDate || undefined,
        latitude: this.post.latitude ?? undefined,
        longitude: this.post.longitude ?? undefined,
        tags: toRaw(this.post.tags) || [],
        status: 'draft',
        statsDetail: {
          duration: this.post.statsDetail?.duration || 0,
        },
      }

      let newId: string | null = null
      await useRequest<{ id: string }>({
        key: EPostRequestKeys.CREATE,
        fn: db => db.posts.create(payload),
        onSuccess: (data) => {
          if (data) {
            newId = data.id
            this.createdServerId = data.id
            this.post.id = data.id
          }
        },
      })

      return newId
    },

    async uploadSingleMedia(file: File): Promise<PostMedia | null> {
      const postId = await this.ensurePostCreated()
      if (!postId)
        return null

      let result: PostMedia | null = null

      await useRequest<TripImage>({
        key: `post:upload-instant:${uuidv4()}`,
        fn: db => db.files.uploadFile(file, postId, 'post', 'content'),
        onSuccess: (uploaded) => {
          if (uploaded) {
            const newMedia: PostMedia = {
              id: uploaded.id,
              type: 'image',
              url: uploaded.url,
              metadata: uploaded.metadata,
              originalName: uploaded.originalName,
              marks: [],
            }
            this.post.media.push(newMedia)
            this.isDirty = true
            result = newMedia
          }
        },
        onError: ({ error }) => {
          useToast().error(`Ошибка загрузки ${file.name}: ${error.customMessage}`)
        },
      })

      return result
    },

    removeGlobalMedia(mediaId: string) {
      const mediaToRemove = this.post.media.find(m => m.id === mediaId)
      if (mediaToRemove && mediaToRemove.url.startsWith('blob:')) {
        URL.revokeObjectURL(mediaToRemove.url)
      }

      this.post.media = this.post.media.filter(m => m.id !== mediaId)
      if (this.post.stages) {
        this.post.stages.forEach((stage) => {
          stage.blocks.forEach((block) => {
            if (block.type === 'gallery') {
              block.images = block.images.filter(img => img.id !== mediaId)
            }
          })
        })
      }
      this.isDirty = true

      useRequest({
        key: `post:delete-media:${mediaId}`,
        fn: db => db.posts.deleteMedia({ id: mediaId }),
      })
    },

    applyAiGeneratedData(data: AiGeneratedPostData) {
      if (data.title)
        this.post.title = data.title
      if (data.insight)
        this.post.insight = data.insight
      if (data.description)
        this.post.description = data.description
      if (data.country)
        this.post.country = data.country

      if (data.tags)
        data.tags.forEach(tag => this.addTag(tag))

      if (data.stages && data.stages.length > 0) {
        this.post.stages = data.stages.map((stage, sIdx) => {
          const blocks: TimelineBlock[] = stage.blocks
            ? stage.blocks.map((block) => {
              const baseId = uuidv4()
              if (block.type === 'text')
                return { id: baseId, type: 'text', content: block.content || '' } as TimelineBlock
              if (block.type === 'location')
                return { id: baseId, type: 'location', coords: block.coords || { lat: 0, lng: 0 }, name: block.name || '', address: block.address || '' } as TimelineBlock
              if (block.type === 'route') {
                return {
                  id: baseId,
                  type: 'route',
                  from: block.from || '',
                  to: block.to || '',
                  distance: block.distance || '',
                  duration: block.duration || '',
                  distanceMeters: 0,
                  transport: block.transport || 'walk',
                  points: [],
                  geometry: [],
                } as any
              }
              return { id: baseId, type: 'text', content: '' } as TimelineBlock
            })
            : []

          return { id: uuidv4(), title: stage.title || `Этап ${sIdx + 1}`, day: stage.day || 1, time: stage.time || '', order: sIdx, blocks } as unknown as TimelineStage
        })
      }
      this.isDirty = true
    },

    async generateWithAi(text: string) {
      await useRequest<AiGeneratedPostData>({
        key: EPostRequestKeys.GENERATE,
        fn: db => db.posts.generateFromText({ text }),
        onSuccess: (data) => {
          if (data) {
            this.applyAiGeneratedData(data)
            useToast().success('Пост успешно сгенерирован!')
          }
        },
        onError: ({ error }) => {
          useToast().error(error.customMessage || 'Ошибка при генерации поста.')
        },
      })
    },

    async addGlobalMedia(files: File[], onProgress?: (count: number) => void): Promise<ClientPostMedia[]> {
      const newMedia: ClientPostMedia[] = []

      let count = 0
      for (const file of files) {
        let thumbUrl = ''
        if (file.type.startsWith('image/')) {
          thumbUrl = await generateThumbnail(file, 800)
        }
        else {
          thumbUrl = URL.createObjectURL(file)
        }

        const media: ClientPostMedia = {
          id: uuidv4(),
          type: 'image',
          url: thumbUrl,
          marks: [],
          file,
          originalName: file.name,
        }
        newMedia.push(media)
        this.post.media.push(media)
        count++
        if (onProgress) {
          onProgress(count)
        }
      }

      this.isDirty = true
      return newMedia
    },

    addTag(tag: string) {
      if (!tag)
        return
      const lowerTag = tag.trim().toLowerCase()
      if (this.post.tags.includes(lowerTag))
        return
      this.post.tags.push(lowerTag)
      this.isDirty = true
    },

    removeTag(tag: string) {
      this.post.tags = this.post.tags.filter(t => t !== tag)
      this.isDirty = true
    },

    addStage() {
      if (!this.post.stages)
        this.post.stages = []

      const lastStage = this.post.stages.length > 0 ? this.post.stages[this.post.stages.length - 1] : null
      const lastDay = lastStage && 'day' in lastStage && typeof lastStage.day === 'number' ? lastStage.day : 1

      this.post.stages.push({
        id: uuidv4(),
        day: lastDay,
        time: '',
        title: 'Новый этап',
        order: this.post.stages.length,
        blocks: [],
      } as unknown as TimelineStage)
      this.isDirty = true
    },

    removeStage(index: number) {
      if (!this.post.stages)
        return
      this.post.stages.splice(index, 1)
      this.isDirty = true
    },

    updateStage(stageId: string, payload: Partial<TimelineStage>) {
      if (!this.post.stages)
        return
      const stage = this.post.stages.find(s => s.id === stageId)
      if (stage) {
        Object.assign(stage, payload)
        this.isDirty = true
      }
    },

    reorderStages(newOrder: TimelineStage[]) {
      this.post.stages = newOrder
      this.isDirty = true
    },

    addBlock(stageId: string, type: TimelineBlockType) {
      if (!this.post.stages)
        return
      const stage = this.post.stages.find(s => s.id === stageId)
      if (!stage)
        return

      let newBlock: TimelineBlock | null = null
      if (type === 'text') {
        newBlock = { id: uuidv4(), type: 'text', content: '' }
      }
      else if (type === 'gallery') {
        newBlock = { id: uuidv4(), type: 'gallery', images: [], comment: '', displayType: 'grid' }
      }
      else if (type === 'location') {
        newBlock = { id: uuidv4(), type: 'location', coords: { lat: 0, lng: 0 }, name: '', address: '' }
      }
      else if (type === 'route') {
        newBlock = { id: uuidv4(), type: 'route', from: '', to: '', distance: '', duration: '', distanceMeters: 0, transport: 'walk', points: [], geometry: [] } as any
      }

      if (newBlock) {
        stage.blocks.push(newBlock)
        this.isDirty = true
      }
    },

    removeBlock(stageId: string, blockId: string) {
      if (!this.post.stages)
        return
      const stage = this.post.stages.find(s => s.id === stageId)
      if (stage) {
        stage.blocks = stage.blocks.filter(b => b.id !== blockId)
        this.isDirty = true
      }
    },

    updateBlock(stageId: string, blockId: string, payload: Partial<TimelineBlock>) {
      if (!this.post.stages)
        return
      const stage = this.post.stages.find(s => s.id === stageId)
      const block = stage?.blocks.find(b => b.id === blockId)
      if (block) {
        Object.assign(block, payload)
        this.isDirty = true
      }
    },

    async savePost(isNew: boolean, publishStatus: 'draft' | 'completed' = 'draft') {
      this.isSaving = true
      if (!this.post.stages)
        this.post.stages = []

      try {
        const postId = await this.ensurePostCreated()
        if (!postId)
          throw new Error('Не удалось получить ID поста')

        const elements = this.post.stages.map((stage: TimelineStage, index: number) => {
          const content = stage.blocks.map((block: any) => {
            if (block.type === 'text')
              return { id: block.id, type: 'markdown' as const, text: block.content || '' }
            if (block.type === 'gallery')
              return { id: block.id, type: 'gallery' as const, imageIds: block.images.map((img: any) => img.id), displayType: block.displayType || 'grid' }
            if (block.type === 'location')
              return { id: block.id, type: 'location' as const, location: { lat: block.coords.lat, lng: block.coords.lng, label: block.name, address: block.address } }
            if (block.type === 'route')
              return { id: block.id, type: 'route' as const, route: { from: block.from, to: block.to, points: block.points || [], geometry: block.geometry || [], distance: block.distance, duration: block.duration, distanceMeters: block.distanceMeters, transport: block.transport } }
            throw new Error(`Неизвестный тип блока: ${block.type}`)
          })

          const day = 'day' in stage && typeof stage.day === 'number' ? stage.day : 1
          return { title: stage.title, day, time: stage.time || null, content, order: index }
        })

        const finalMediaIds = this.post.media.map(m => m.id)

        const payload: Partial<UpdatePostInput> = {
          title: this.post.title || 'Новый маршрут',
          insight: this.post.insight || undefined,
          description: this.post.description || undefined,
          country: this.post.country || undefined,
          startDate: this.post.startDate || undefined,
          latitude: this.post.latitude ?? undefined,
          longitude: this.post.longitude ?? undefined,
          tags: toRaw(this.post.tags) || [],
          status: publishStatus,
          statsDetail: { duration: this.post.statsDetail.duration || 0 },
          mediaIds: finalMediaIds,
          elements,
        }

        await useRequest({
          key: EPostRequestKeys.UPDATE,
          fn: db => db.posts.update({ id: postId, data: payload }),
          onError: ({ error }) => {
            throw new Error(error.customMessage || 'Ошибка при сохранении поста.')
          },
        })

        this.isDirty = false

        if (this.isNewPost) {
          localStorage.removeItem('trip_scheduler_post_draft_new')
        }
        else {
          localStorage.removeItem(`trip_scheduler_post_draft_${this.post.id}`)
        }

        return postId
      }
      catch (e) {
        console.error('Save error', e)
        this.isSaving = false
        throw e
      }
      finally {
        this.isSaving = false
      }
    },
  },
})
