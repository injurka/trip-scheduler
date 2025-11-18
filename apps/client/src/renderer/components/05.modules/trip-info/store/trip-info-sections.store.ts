import type { TripSection } from '~/shared/types/models/trip'
import { defineStore } from 'pinia'
import { useTripPlanStore } from '~/components/04.features/trip-info/trip-plan'
import { useRequest } from '~/plugins/request'
import { TripSectionType } from '~/shared/types/models/trip'

export enum ETripSectionsKeys {
  CREATE = 'trip-section:create',
  UPDATE = 'trip-section:update',
  DELETE = 'trip-section:delete',
}

export interface ITripSectionsState {
  sections: TripSection[]
}

export const useTripSectionsStore = defineStore('tripSections', {
  state: (): ITripSectionsState => ({
    sections: [],
  }),

  getters: {
    // Получаем отсортированные разделы
    sortedSections: (state): TripSection[] => {
      return [...state.sections].sort((a, b) => a.order - b.order)
    },
    // Получаем Set существующих уникальных типов секций (всех, кроме NOTES)
    existingUniqueSectionTypes: (state): Set<TripSectionType> => {
      return new Set(
        state.sections
          .map(s => s.type)
          .filter(t => t !== TripSectionType.NOTES),
      )
    },
  },

  actions: {
    // Этот экшен будет вызываться из основного стора для инициализации
    setSections(sections: TripSection[]) {
      this.sections = sections
    },

    async addSection(type: TripSectionType) {
      const tripPlanStore = useTripPlanStore()
      if (!tripPlanStore.currentTripId) {
        useToast().error('Невозможно создать раздел: не определено путешествие.')
        return
      }

      // Определение контента и иконки по умолчанию для каждого типа раздела
      let defaultContent: any = {}
      let defaultIcon = 'mdi:file-document-outline'
      let defaultTitle = 'Новый раздел'

      switch (type) {
        case TripSectionType.NOTES:
          defaultContent = { markdown: '' }
          defaultIcon = 'mdi:note-text-outline'
          defaultTitle = 'Заметки'
          break
        case TripSectionType.BOOKINGS:
          defaultContent = { items: [] }
          defaultIcon = 'mdi:book-multiple-outline'
          defaultTitle = 'Бронирования'
          break
        case TripSectionType.FINANCES:
          defaultContent = { totalBudget: 0, expenses: [] }
          defaultIcon = 'mdi:cash-multiple'
          defaultTitle = 'Финансы'
          break
        case TripSectionType.CHECKLIST:
          defaultContent = { items: [] }
          defaultIcon = 'mdi:format-list-checks'
          defaultTitle = 'Чек-лист'
          break
        case TripSectionType.MAP:
          defaultContent = {}
          defaultIcon = 'mdi:map-search-outline'
          defaultTitle = 'Карта путешествия'
          break
      }

      // Оптимистичное добавление
      const tempId = `temp-section-${Date.now()}`
      const newSection: TripSection = {
        id: tempId,
        tripId: tripPlanStore.currentTripId,
        type,
        title: defaultTitle,
        icon: defaultIcon,
        content: defaultContent,
        order: this.sections.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.sections.push(newSection)

      await useRequest({
        key: `${ETripSectionsKeys.CREATE}:${tempId}`,
        fn: db => db.tripSections.create({
          tripId: tripPlanStore.currentTripId!,
          type,
          title: defaultTitle,
          icon: defaultIcon,
          content: defaultContent,
        }),
        onSuccess: (createdSection) => {
          const index = this.sections.findIndex(s => s.id === tempId)
          if (index !== -1 && createdSection) {
            this.sections[index] = createdSection as TripSection
          }
        },
        onError: (error) => {
          this.sections = this.sections.filter(s => s.id !== tempId)
          useToast().error(`Ошибка при создании раздела: ${error}`)
        },
      })
    },

    async updateSection(section: TripSection) {
      const index = this.sections.findIndex(s => s.id === section.id)
      if (index === -1)
        return

      const originalSection = { ...this.sections[index] }
      this.sections[index] = section // Оптимистичное обновление

      await useRequest({
        key: `${ETripSectionsKeys.UPDATE}:${section.id}`,
        fn: db => db.tripSections.update({
          id: section.id,
          title: section.title,
          icon: section.icon,
          content: section.content,
        }),
        onError: (error) => {
          this.sections[index] = originalSection // Откат
          useToast().error(`Ошибка при обновлении раздела: ${error}`)
        },
      })
    },

    async clearSection(sectionId: string) {
      const index = this.sections.findIndex(s => s.id === sectionId)
      if (index === -1) {
        useToast().error('Не удалось найти раздел для очистки.')
        return
      }

      const sectionToClear = this.sections[index]

      let defaultContent: any = {}
      switch (sectionToClear.type) {
        case TripSectionType.NOTES:
          defaultContent = { markdown: '' }
          break
        case TripSectionType.BOOKINGS:
          defaultContent = { items: [] }
          break
        case TripSectionType.FINANCES:
          defaultContent = { totalBudget: 0, expenses: [] }
          break
        case TripSectionType.CHECKLIST:
          defaultContent = { items: [] }
          break
      }

      const clearedSection: TripSection = {
        ...sectionToClear,
        content: defaultContent,
      }

      await this.updateSection(clearedSection)
      useToast().success(`Раздел "${clearedSection.title}" был очищен.`)
    },

    async deleteSection(sectionId: string) {
      const index = this.sections.findIndex(s => s.id === sectionId)
      if (index === -1)
        return

      const [removedSection] = this.sections.splice(index, 1) // Оптимистичное удаление

      await useRequest({
        key: `${ETripSectionsKeys.DELETE}:${sectionId}`,
        fn: db => db.tripSections.delete(sectionId),
        onError: (error) => {
          this.sections.splice(index, 0, removedSection) // Откат
          useToast().error(`Ошибка при удалении раздела: ${error}`)
        },
      })
    },

    // Очистка состояния при выходе со страницы
    reset() {
      this.sections = []
    },
  },
})
