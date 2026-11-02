import type { ActivityPayload, Booking, DayMetaInfo } from '../types'
import type { MetroCatalogSource } from './metro-resolver'

export interface ImportTemplateActivity extends ActivityPayload {
  id: string
  dayId: string
  status: 'none' | 'completed' | 'skipped'
}

export interface ImportDayContext {
  dayNumber: number
  date: string
  title: string
  description?: string | null
  activitiesSummary: Array<{ startTime: string, endTime: string, title: string, tag: ActivityPayload['tag'] }>
}

export interface ImportGeoPlace {
  id: string
  name: string
  countryCode: string
  countryName: string
  regionName: string | null
  kind: 'settlement' | 'island' | 'area'
  retired: boolean
}

export interface ImportGeoResolution {
  status: 'resolved' | 'unresolved' | 'needs_review'
  reason: string
  place: ImportGeoPlace | null
  candidates: Array<{ place: ImportGeoPlace, score: number, matchedName: string }>
}

/**
 * Абстракция транспорта импорта: obsidian-importer пишет данные в Trip Scheduler
 * либо через REST API (ApiClient, CLI-режим), либо напрямую через серверные
 * репозитории (InProcessTransport в apps/server, headless-импорт внутри сервера).
 * Интерфейс объявлен в пакете импортера, реализация — у потребителя (DIP).
 *
 * @module
 */

export interface Transport extends Partial<MetroCatalogSource> {
  resolveCity?: (label: string) => Promise<ImportGeoResolution>
  getGeoPlacesByIds?: (ids: string[]) => Promise<ImportGeoPlace[]>
  searchGeoPlaces?: (query: string) => Promise<ImportGeoPlace[]>

  createTrip: (payload: {
    title: string
    shareSlug?: string
    description?: string
    startDate?: string
    endDate?: string
    budget?: number | null
    currency?: string | null
  }) => Promise<{ id: string, title: string }>

  updateTrip: (id: string, details: {
    title?: string
    shareSlug?: string
    description?: string
    descriptionShort?: string
    imageUrl?: string | null
    cities?: string[]
    tags?: string[]
    status?: 'planned' | 'draft' | 'completed'
    visibility?: 'private' | 'public'
    startDate?: string
    endDate?: string
    budget?: number | null
    currency?: string | null
    cityIds?: string[]
  }) => Promise<unknown>

  deleteTrip?: (id: string) => Promise<unknown>

  getTripDetails: (tripId: string) => Promise<{ sections?: ImportTripSection[] } | null>

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
    meta?: DayMetaInfo[]
    date?: string
  }) => Promise<unknown>

  deleteDay: (id: string) => Promise<unknown>

  createActivity: (payload: {
    dayId: string
    title: string
    startTime: string
    endTime: string
    tag?: string
    sections?: ActivityPayload['sections']
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
    currentActivities: ImportTemplateActivity[]
    canvasNote: string
    daysContext?: ImportDayContext[] | null
  }) => Promise<ActivityPayload[]>

  uploadImage?: (
    tripId: string,
    filePath: string,
    placement?: 'route' | 'memories' | 'notes' | 'documents',
    metadata?: Record<string, unknown>,
  ) => Promise<string>

  listDocuments?: (tripId: string) => Promise<ImportDocument[]>

  updateDocumentMeta?: (
    id: string,
    metadata: {
      folderId?: string | null
      access?: 'public' | 'private'
      title?: string | null
      category?: string | null
      isFavorite?: boolean
      note?: string | null
    },
  ) => Promise<unknown>
}

export type { ActivityPayload, Booking, DayMetaInfo }

export interface ImportDocument {
  id: string
  tripId: string
  url: string
  originalName: string
  sizeBytes: number
  metadata?: {
    folderId?: string | null
    access?: 'public' | 'private'
    title?: string | null
    category?: string | null
    isFavorite?: boolean | null
    note?: string | null
  } | null
}

export interface ImportTripSection {
  id: string
  type: string
  title: string
  content?: unknown
}

export interface ImportTripSummary {
  id: string
  title: string
  description?: string | null
  descriptionShort?: string | null
  imageUrl?: string | null
  tags?: string[]
  cities?: string[]
  startDate?: string
  endDate?: string
  status?: string
  sections?: ImportTripSection[]
  days?: Array<{ id: string, date?: string | null, title: string }>
}
