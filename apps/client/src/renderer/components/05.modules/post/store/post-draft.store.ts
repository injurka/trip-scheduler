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
import { useRequest } from '~/plugins/request'
import { EPostRequestKeys } from './post.store'

type ClientPostMedia = PostMedia & { file?: File }

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

export const usePostDraftStore = defineStore('post-draft', {
  state: () => ({
    post: defaultPostState() as PostDetail,
    isDirty: false,
    isSaving: false,
  }),

  actions: {
    initDraft(existingPost?: PostDetail) {
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
      this.isDirty = false
    },

    addGlobalMedia(files: File[]): ClientPostMedia[] {
      const newMedia: ClientPostMedia[] = files.map(file => ({
        id: uuidv4(),
        type: 'image',
        url: URL.createObjectURL(file),
        marks: [],
        file,
      }))

      this.post.media.push(...newMedia)
      this.isDirty = true
      return newMedia
    },

    removeGlobalMedia(mediaId: string) {
      this.post.media = this.post.media.filter(m => m.id !== mediaId)
      if (!this.post.stages)
        return
      this.post.stages.forEach((stage) => {
        stage.blocks.forEach((block) => {
          if (block.type === 'gallery') {
            block.images = block.images.filter(img => img.id !== mediaId)
          }
        })
      })
      this.isDirty = true
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

      const lastDay = this.post.stages.length > 0 ? this.post.stages[this.post.stages.length - 1].day : 1

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
        newBlock = { id: uuidv4(), type: 'gallery', images: [], comment: '' }
      }
      else if (type === 'location') {
        newBlock = { id: uuidv4(), type: 'location', coords: { lat: 0, lng: 0 }, name: '', address: '' }
      }
      else if (type === 'route') {
        newBlock = { id: uuidv4(), type: 'route', from: '', to: '', distance: '', duration: '', transport: 'walk' }
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
        let postId = this.post.id

        // 1. Создаем базовую сущность поста в БД, чтобы получить валидный ID (избегаем 404 ошибки)
        if (isNew) {
          const initialPayload: CreatePostInput = {
            title: this.post.title || 'Новый маршрут',
            insight: this.post.insight || undefined,
            description: this.post.description || undefined,
            country: this.post.country || undefined,
            startDate: this.post.startDate || undefined,
            latitude: this.post.latitude || undefined,
            longitude: this.post.longitude || undefined,
            tags: this.post.tags || [],
            status: 'draft',
            statsDetail: {
              duration: this.post.statsDetail.duration || 0,
            },
          }

          let createdPostId: string | null = null
          await useRequest<{ id: string }>({
            key: EPostRequestKeys.CREATE,
            fn: db => db.posts.create(initialPayload),
            onSuccess: (data) => {
              if (data) {
                createdPostId = data.id
                this.post.id = createdPostId
              }
            },
            onError: ({ error }) => {
              throw new Error(error.customMessage || 'Ошибка при создании поста.')
            },
          })

          if (!createdPostId) {
            throw new Error('Не удалось получить ID созданного поста.')
          }
          postId = createdPostId
        }

        // 2. Загружаем файлы
        const filesToUpload = this.post.media.filter(m => (m as ClientPostMedia).file) as ClientPostMedia[]
        const idMap = new Map<string, string>()

        if (filesToUpload.length > 0) {
          const uploadPromises = filesToUpload.map(media =>
            useRequest<TripImage>({
              key: `post:upload:${media.id}`,
              fn: db => db.files.uploadFile(media.file!, postId, 'post', 'content'),
              onSuccess: (uploaded) => {
                if (uploaded) {
                  idMap.set(media.id, uploaded.id)
                  const originalMedia = this.post.media.find(m => m.id === media.id) as ClientPostMedia | undefined
                  if (originalMedia) {
                    originalMedia.id = uploaded.id
                    originalMedia.url = uploaded.url
                    delete originalMedia.file
                  }
                }
              },
              onError: ({ error }) => {
                console.error(`Ошибка загрузки файла ${media.file?.name}:`, error.customMessage)
                throw new Error(`Ошибка загрузки файла ${media.file?.name}.`)
              },
            }),
          )
          await Promise.all(uploadPromises)
        }

        // 3. Формируем элементы без any и без внешних TS-типов (используем вывод типов TS)
        const elements = this.post.stages.map((stage: TimelineStage) => {
          const content = stage.blocks.map((block: TimelineBlock) => {
            if (block.type === 'text') {
              return { id: block.id, type: 'markdown' as const, text: block.content || '' }
            }
            if (block.type === 'gallery') {
              return {
                id: block.id,
                type: 'gallery' as const,
                displayType: 'grid' as const,
                imageIds: block.images.map(img => idMap.get(img.id) || img.id),
              }
            }
            if (block.type === 'location') {
              return {
                id: block.id,
                type: 'location' as const,
                location: {
                  lat: block.coords.lat,
                  lng: block.coords.lng,
                  label: block.name,
                  address: block.address,
                },
              }
            }
            if (block.type === 'route') {
              return {
                id: block.id,
                type: 'route' as const,
                route: { points: [] },
              }
            }
            throw new Error(`Неизвестный тип блока`) // Убрали block.type из ошибки, чтобы избежать type 'never'
          })

          return {
            title: stage.title,
            day: stage.day || 1,
            time: stage.time || null,
            content,
          }
        })

        const finalMediaIds = this.post.media.map(m => idMap.get(m.id) || m.id)

        const payload: Partial<UpdatePostInput> = {
          title: this.post.title || 'Новый маршрут',
          insight: this.post.insight || undefined,
          description: this.post.description || undefined,
          country: this.post.country || undefined,
          startDate: this.post.startDate || undefined,
          latitude: this.post.latitude || undefined,
          longitude: this.post.longitude || undefined,
          tags: this.post.tags || [],
          status: publishStatus,
          statsDetail: {
            duration: this.post.statsDetail.duration || 0,
          },
          mediaIds: finalMediaIds,
          elements,
        }

        await useRequest({
          key: EPostRequestKeys.UPDATE,
          fn: db => db.posts.update({ id: postId, data: payload }),
        })

        this.isDirty = false
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
