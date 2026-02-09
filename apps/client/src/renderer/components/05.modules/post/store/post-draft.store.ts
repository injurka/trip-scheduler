import type { PostDetail, PostMedia, TimelineBlockType, TimelineStage } from '~/shared/types/models/post'
import type { TripImage } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { useRequest } from '~/plugins/request'

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
    tags: [],
    media: [],
    elements: [],
    statsDetail: { views: 0, budget: '', duration: '' },
    stages: [
      { id: uuidv4(), title: 'Начало', order: 0, blocks: [] },
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
          this.post.statsDetail = { views: 0, budget: '', duration: '' }
        }
        // Гарантируем, что stages всегда массив
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
          if (block.type === 'gallery' && 'images' in block) {
            block.images = block.images.filter(img => img.id !== mediaId)
          }
        })
      })
      this.isDirty = true
    },

    addTag(tag: string) {
      if (!tag || this.post.tags.includes(tag))
        return
      this.post.tags.push(tag)
      this.isDirty = true
    },

    removeTag(tag: string) {
      this.post.tags = this.post.tags.filter(t => t !== tag)
      this.isDirty = true
    },

    addStage() {
      if (!this.post.stages)
        this.post.stages = []
      this.post.stages.push({
        id: uuidv4(),
        title: 'Новый этап',
        order: this.post.stages.length,
        blocks: [],
      })
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

      const newBlock: any = { id: uuidv4(), type }

      if (type === 'text') {
        newBlock.content = ''
      }
      else if (type === 'gallery') {
        newBlock.images = []
        newBlock.comment = ''
      }
      else if (type === 'location') {
        newBlock.coords = { lat: 0, lng: 0 }
        newBlock.name = ''
        newBlock.address = ''
      }
      else if (type === 'route') {
        newBlock.from = ''
        newBlock.to = ''
        newBlock.distance = ''
        newBlock.duration = ''
        newBlock.transport = 'walk'
      }

      stage.blocks.push(newBlock)
      this.isDirty = true
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

    updateBlock(stageId: string, blockId: string, payload: any) {
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

        const elements = this.post.stages.map(stage => ({
          title: stage.title,
          content: stage.blocks.map((block: any) => {
            const mappedBlock: any = { id: block.id }

            if (block.type === 'text') {
              mappedBlock.type = 'markdown'
              mappedBlock.text = block.content || ''
            }
            else if (block.type === 'gallery') {
              mappedBlock.type = 'gallery'
              mappedBlock.displayType = 'grid'
              mappedBlock.imageIds = block.images.map((img: any) => idMap.get(img.id) || img.id)
            }
            else if (block.type === 'location') {
              mappedBlock.type = 'location'
              mappedBlock.location = {
                lat: block.coords.lat,
                lng: block.coords.lng,
                label: block.name,
                address: block.address,
              }
            }
            else if (block.type === 'route') {
              mappedBlock.type = 'route'
              mappedBlock.route = { points: [] }
            }
            return mappedBlock
          }),
        }))

        const finalMediaIds = this.post.media.map(m => idMap.get(m.id) || m.id)

        const payload = {
          title: this.post.title,
          insight: this.post.insight,
          description: this.post.description,
          country: this.post.country,
          latitude: this.post.latitude,
          longitude: this.post.longitude,
          tags: this.post.tags,
          status: publishStatus,
          statsDetail: {
            budget: this.post.statsDetail.budget,
            duration: this.post.statsDetail.duration,
          },
          mediaIds: finalMediaIds,
          elements,
        }

        if (isNew) {
          await useRequest<{ id: string }>({
            key: 'post:create',
            fn: db => db.posts.create(payload),
            onSuccess: (data) => {
              if (data)
                postId = data.id
            },
          })
        }
        else {
          await useRequest({
            key: 'post:update',
            fn: db => db.posts.update({ id: postId, data: payload }),
          })
        }

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
