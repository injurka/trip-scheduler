import type { PostDetail, TimelineBlock, TimelineBlockType, TimelineStage } from '../models/types'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

function defaultPostState(): Partial<PostDetail> {
  return {
    id: uuidv4(),
    title: '',
    insight: '',
    category: 'other',
    ratingEmoji: '😎',
    location: { city: '', country: '', address: '', lat: 0, lng: 0 },
    tags: { category: [], context: [] },
    media: [],
    stages: [
      { id: uuidv4(), title: 'Начало', blocks: [] },
    ],
  }
}

export const usePostDraftStore = defineStore('post-draft', {
  state: () => ({
    post: defaultPostState() as PostDetail,
    isDirty: false,
  }),

  actions: {
    initDraft(existingPost?: PostDetail) {
      if (existingPost) {
        this.post = JSON.parse(JSON.stringify(existingPost))
      }
      else {
        this.post = defaultPostState() as PostDetail
      }
      this.isDirty = false
    },

    // --- Stages Management ---
    addStage() {
      this.post.stages.push({
        id: uuidv4(),
        title: 'Новый этап',
        blocks: [],
      })
      this.isDirty = true
    },

    removeStage(index: number) {
      this.post.stages.splice(index, 1)
      this.isDirty = true
    },

    updateStage(stageId: string, payload: Partial<TimelineStage>) {
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

    // --- Blocks Management ---
    addBlock(stageId: string, type: TimelineBlockType) {
      const stage = this.post.stages.find(s => s.id === stageId)
      if (!stage)
        return

      let newBlock: TimelineBlock

      switch (type) {
        case 'text':
          newBlock = { id: uuidv4(), type: 'text', content: '' }
          break
        case 'gallery':
          newBlock = { id: uuidv4(), type: 'gallery', images: [] }
          break
        case 'location':
          newBlock = { id: uuidv4(), type: 'location', name: '', address: '', coords: { lat: 0, lng: 0 } }
          break
        case 'route':
          newBlock = { id: uuidv4(), type: 'route', from: '', to: '', distance: '', duration: '', transport: 'walk' }
          break
      }

      stage.blocks.push(newBlock)
      this.isDirty = true
    },

    removeBlock(stageId: string, blockId: string) {
      const stage = this.post.stages.find(s => s.id === stageId)
      if (stage) {
        stage.blocks = stage.blocks.filter(b => b.id !== blockId)
        this.isDirty = true
      }
    },

    updateBlock(stageId: string, blockId: string, payload: any) {
      const stage = this.post.stages.find(s => s.id === stageId)
      const block = stage?.blocks.find(b => b.id === blockId)
      if (block) {
        Object.assign(block, payload)
        this.isDirty = true
      }
    },
  },
})
