import type { ActivityPayload, Booking } from '../types'

/**
 * Абстракция транспорта импорта: obsidian-importer пишет данные в Trip Scheduler
 * либо через REST API (ApiClient, CLI-режим), либо напрямую через серверные
 * репозитории (InProcessTransport в apps/server, headless-импорт внутри сервера).
 * Интерфейс объявлен в пакете импортера, реализация — у потребителя (DIP).
 *
 * @module
 */

export interface Transport {
  createTrip: (payload: {
    title: string
    description?: string
    startDate?: string
    endDate?: string
  }) => Promise<{ id: string, title: string }>

  updateTrip: (id: string, details: {
    title?: string
    description?: string
    descriptionShort?: string
    cities?: string[]
    tags?: string[]
    status?: 'planned' | 'draft' | 'completed'
    visibility?: 'private' | 'public'
    startDate?: string
    endDate?: string
  }) => Promise<unknown>

  getTripDetails: (tripId: string) => Promise<{ sections?: Array<{ id: string, type: string, title: string }> } | null>

  getDaysByTripId: (tripId: string) => Promise<Array<{ id: string, date: string, title: string }>>

  createDay: (payload: {
    tripId: string
    title: string
    description?: string | null
    date: string
  }) => Promise<{ id: string, title: string }>

  updateDay: (id: string, details: {
    title?: string
    description?: string | null
    note?: string | null
    meta?: unknown[]
    date?: string
  }) => Promise<unknown>

  deleteDay: (id: string) => Promise<unknown>

  createActivity: (payload: {
    dayId: string
    title: string
    startTime: string
    endTime: string
    tag?: string
    sections?: unknown[]
  }) => Promise<unknown>

  createTripSection: (payload: {
    tripId: string
    type: string
    title: string
    icon?: string | null
    content?: unknown
  }) => Promise<unknown>

  updateTripSection: (id: string, payload: {
    title?: string
    icon?: string | null
    content?: unknown
  }) => Promise<unknown>

  createNote: (payload: {
    tripId: string
    parentId?: string | null
    type: 'folder' | 'markdown' | 'excalidraw'
    title: string
    order?: number
    color?: string | null
  }) => Promise<{ id: string, title: string }>

  updateNote: (id: string, payload: {
    title?: string
    content?: string | null
    parentId?: string | null
    order?: number
    color?: string | null
  }) => Promise<unknown>

  generateDayTemplate?: (dayId: string, payload: {
    prompt: string
    currentActivities: unknown[]
    canvasNote: string
  }) => Promise<ActivityPayload[]>

  uploadImage?: (tripId: string, filePath: string, placement?: 'route' | 'memories' | 'notes' | 'documents') => Promise<string>
}

export type { ActivityPayload, Booking }
