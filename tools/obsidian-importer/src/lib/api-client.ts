import type { ActivityPayload, DayMetaInfo } from '../types'
import type { MetroCatalogDetails, MetroCatalogSystem } from './metro-resolver'
import type { ImportDayContext, ImportDocument, ImportGeoPlace, ImportGeoResolution, ImportTemplateActivity, ImportTripSummary } from './transport'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { getErrorCode, getErrorMessage, isRecord } from './value-guards'

interface AuthResponse { token: { accessToken: string }, user: { id: string } }

export interface ValidationIssue {
  path?: Array<string | number>
  message?: string
  code?: string
}

export class ApiHttpError extends Error {
  readonly status: number
  readonly issues: ValidationIssue[]

  constructor(message: string, status: number, issues: ValidationIssue[] = []) {
    super(message)
    this.name = 'ApiHttpError'
    this.status = status
    this.issues = issues
  }
}

/**
 * Сервер собирает ActivitySectionSchema из своего кода. Старые версии API
 * (до поддержки `transportMode: "transit"`) отвергают такие маршруты целиком.
 * Импортёр — отдельный пакет, поэтому умеет откатиться на поддерживаемый режим,
 * не теряя саму точку/маршрут.
 */
function isTransitModeRejected(error: unknown): boolean {
  if (!(error instanceof ApiHttpError) || error.status !== 400)
    return false
  return error.issues.some(issue =>
    issue.path?.includes('transportMode')
    && (issue.code === undefined || issue.code === 'invalid_value' || issue.code === 'invalid_enum_value'),
  )
}

function hasTransitRoute(sections: ActivityPayload['sections']): boolean {
  return (sections ?? []).some(section =>
    section.type === 'geolocation'
    && section.routes.some(route => route?.transportMode === 'transit'),
  )
}

function downgradeTransitToCar<T extends { sections?: ActivityPayload['sections'] }>(payload: T): T {
  if (!payload.sections)
    return payload
  return {
    ...payload,
    sections: payload.sections.map(section => section.type === 'geolocation'
      ? {
          ...section,
          routes: section.routes.map(route =>
            route?.transportMode === 'transit' ? { ...route, transportMode: 'car' } : route),
        }
      : section),
  }
}

function formatIssues(issues: ValidationIssue[]): string {
  const details = issues
    .map((issue) => {
      const path = issue.path?.length ? issue.path.join('.') : ''
      return [path, issue.message].filter(Boolean).join(': ')
    })
    .filter(Boolean)
  return details.length > 0 ? ` (${details.join('; ')})` : ''
}

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'svg': return 'image/svg+xml'
    case 'doc': return 'application/msword'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'xls': return 'application/vnd.ms-excel'
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'txt': return 'text/plain'
    case 'mp4': return 'video/mp4'
    default: return 'application/octet-stream'
  }
}

export class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private onWarning?: (message: string) => void

  constructor(apiUrl: string, options: { onWarning?: (message: string) => void } = {}) {
    this.baseUrl = apiUrl.replace(/\/+$/, '')
    this.onWarning = options.onWarning
  }

  public setToken(token: string): void {
    this.token = token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const maxRetries = 3
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        })

        const text = await response.text()
        let data: unknown
        try {
          data = JSON.parse(text)
        }
        catch {
          data = text
        }

        if (!response.ok) {
          const issues: ValidationIssue[] = isRecord(data) && Array.isArray(data.issues)
            ? data.issues.filter((issue): issue is ValidationIssue => isRecord(issue) && (issue.message === undefined || typeof issue.message === 'string') && (issue.code === undefined || typeof issue.code === 'string') && (issue.path === undefined || (Array.isArray(issue.path) && issue.path.every(part => typeof part === 'string' || typeof part === 'number'))))
            : []
          const baseMessage = isRecord(data) && typeof data.message === 'string'
            ? data.message
            : (isRecord(data) && data.error ? JSON.stringify(data.error) : `HTTP ${response.status}: ${text}`)
          throw new ApiHttpError(`${baseMessage}${formatIssues(issues)}`, response.status, issues)
        }

        return data as T
      }
      catch (err) {
        lastError = err
        const isSocketOrNetworkError = getErrorMessage(err)?.includes('socket connection was closed')
          || getErrorMessage(err)?.includes('ECONNRESET')
          || getErrorMessage(err)?.includes('ETIMEDOUT')
          || getErrorCode(err) === 'ECONNRESET'

        if (attempt < maxRetries && isSocketOrNetworkError) {
          const backoff = (attempt + 1) * 750
          await new Promise(resolve => setTimeout(resolve, backoff))
          continue
        }
        throw err
      }
    }

    throw lastError
  }

  async listMetroSystems(): Promise<MetroCatalogSystem[]> {
    return this.request('/metro/systems')
  }

  async getMetroSystemDetails(systemId: string): Promise<MetroCatalogDetails> {
    return this.request(`/metro/systems/${encodeURIComponent(systemId)}`)
  }

  async resolveCity(label: string): Promise<ImportGeoResolution> {
    return this.request('/geo/places/resolve', {
      method: 'POST',
      body: JSON.stringify({ label }),
    })
  }

  async getGeoPlacesByIds(ids: string[]): Promise<ImportGeoPlace[]> {
    return this.request('/geo/places/by-ids', {
      method: 'POST',
      body: JSON.stringify({ ids, locale: 'ru' }),
    })
  }

  async searchGeoPlaces(query: string): Promise<ImportGeoPlace[]> {
    const params = new URLSearchParams({ query: query.trim(), locale: 'ru', limit: '20' })
    return this.request(`/geo/places/search?${params.toString()}`)
  }

  // 1. Auth: SignIn
  async signIn(email: string, password: string): Promise<{ accessToken: string, user: { id: string } }> {
    try {
      const res = await this.request<{ token: { accessToken: string }, user: { id: string } }>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (res?.token?.accessToken) {
        this.setToken(res.token.accessToken)
        return { accessToken: res.token.accessToken, user: res.user }
      }
    }
    catch (err) {
      try {
        const trpcRes = await this.request<{ result?: { data: AuthResponse } } & Partial<AuthResponse>>('/trpc/user.signIn', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        const result = trpcRes?.result?.data || trpcRes
        if (result?.token?.accessToken && result.user) {
          this.setToken(result.token.accessToken)
          return { accessToken: result.token.accessToken, user: result.user }
        }
      }
      catch {
        // ignore
      }
      throw new Error(`Ошибка авторизации: ${getErrorMessage(err)}`)
    }

    throw new Error('Не удалось получить accessToken при входе')
  }

  // 2. Trip Endpoints
  async createTrip(payload: {
    title: string
    shareSlug?: string
    description?: string
    startDate?: string
    endDate?: string
  }): Promise<{ id: string, title: string, startDate: string, endDate: string }> {
    return await this.request('/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateTrip(id: string, details: {
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
  }): Promise<unknown> {
    return await this.request(`/trips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, details }),
    })
  }

  async getTrips(tab: 'my' | 'public' = 'my'): Promise<ImportTripSummary[]> {
    return await this.request(`/trips?tab=${tab}`, {
      method: 'GET',
    })
  }

  async getTripById(tripId: string): Promise<ImportTripSummary> {
    return await this.request(`/trips/${tripId}`, {
      method: 'GET',
    })
  }

  async deleteTrip(tripId: string): Promise<unknown> {
    return await this.request(`/trips/${tripId}`, { method: 'DELETE' })
  }

  async getTripDetails(tripId: string): Promise<ImportTripSummary> {
    try {
      return await this.request(`/trips/${tripId}/details`, {
        method: 'GET',
      })
    }
    catch {
      return await this.request(`/trips/${tripId}`, {
        method: 'GET',
      })
    }
  }

  // 3. Trip Sections (Tabs: Bookings, Checklist, Finances, Memories, Notes, Documents)
  async createTripSection(payload: {
    tripId: string
    type: string
    title: string
    icon?: string | null
    content?: unknown
  }): Promise<unknown> {
    try {
      return await this.request('/trip-sections', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
    catch {
      return await this.request('/trpc/tripSection.create', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
  }

  async updateTripSection(id: string, payload: {
    title?: string
    icon?: string | null
    content?: unknown
  }): Promise<unknown> {
    try {
      return await this.request(`/trip-sections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ id, ...payload }),
      })
    }
    catch {
      return await this.request('/trpc/tripSection.update', {
        method: 'POST',
        body: JSON.stringify({ id, ...payload }),
      })
    }
  }

  async getDaysByTripId(tripId: string): Promise<Array<{ id: string, date: string, title: string, activities?: Array<{ id: string, title: string, startTime: string, endTime: string, sections?: Array<{ id: string, type: string }> }> }>> {
    return await this.request(`/days/by-trip/${tripId}`, {
      method: 'GET',
    })
  }

  // 4. Day Endpoints
  async createDay(payload: {
    tripId: string
    title: string
    description?: string | null
    date: string
  }): Promise<{ id: string, title: string }> {
    return await this.request('/days', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateDay(id: string, details: {
    title?: string
    description?: string | null
    note?: string | null
    meta?: DayMetaInfo[]
    date?: string
  }): Promise<unknown> {
    return await this.request(`/days/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, details }),
    })
  }

  async deleteDay(id: string): Promise<unknown> {
    return await this.request(`/days/${id}`, {
      method: 'DELETE',
    })
  }

  async generateDayTemplate(dayId: string, payload: {
    prompt: string
    currentActivities: ImportTemplateActivity[]
    canvasNote: string
    daysContext?: ImportDayContext[] | null
  }): Promise<ActivityPayload[]> {
    return await this.request<ActivityPayload[]>(`/days/${dayId}/generate-template`, {
      method: 'POST',
      body: JSON.stringify({
        dayId,
        prompt: payload.prompt,
        currentActivities: payload.currentActivities,
        canvasNote: payload.canvasNote,
        daysContext: payload.daysContext,
      }),
    })
  }

  async createActivity(payload: {
    dayId: string
    title: string
    startTime: string
    endTime: string
    tag?: string
    sections?: ActivityPayload['sections']
  }): Promise<unknown> {
    return this.sendActivity('POST', '/activities', payload)
  }

  async updateActivity(payload: {
    id: string
    dayId: string
    title: string
    startTime: string
    endTime: string
    tag?: string
    sections?: ActivityPayload['sections']
  }): Promise<unknown> {
    return this.sendActivity('PATCH', `/activities/${payload.id}`, payload)
  }

  private async sendActivity(
    method: 'POST' | 'PATCH',
    path: string,
    payload: { sections?: ActivityPayload['sections'] } & Record<string, unknown>,
  ): Promise<unknown> {
    try {
      return await this.request(path, {
        method,
        body: JSON.stringify(payload),
      })
    }
    catch (error) {
      if (!isTransitModeRejected(error) || !hasTransitRoute(payload.sections))
        throw error

      this.onWarning?.('⚠ API не поддерживает transportMode «transit» (устаревшая версия сервера). Маршрут импортируется как «car».')
      return await this.request(path, {
        method,
        body: JSON.stringify(downgradeTransitToCar(payload)),
      })
    }
  }

  async deleteActivity(id: string): Promise<unknown> {
    return await this.request(`/activities/${id}`, {
      method: 'DELETE',
    })
  }

  // 6. Note Endpoints
  async createNote(payload: {
    tripId: string
    parentId?: string | null
    type: 'folder' | 'markdown' | 'excalidraw'
    title: string
    order?: number
    color?: string | null
  }): Promise<{ id: string, title: string, type: string }> {
    return await this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateNote(id: string, payload: {
    title?: string
    content?: string | null
    parentId?: string | null
    order?: number
    color?: string | null
  }): Promise<unknown> {
    return await this.request(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, ...payload }),
    })
  }

  async getNotesByTripId(tripId: string): Promise<Array<{ id: string, parentId?: string | null, type: string, title: string }>> {
    return await this.request(`/notes/by-trip/${tripId}`, { method: 'GET' })
  }

  // 7. Image & Document Upload Endpoint
  async uploadImage(
    tripId: string,
    filePath: string,
    placement: 'route' | 'memories' | 'notes' | 'documents' = 'route',
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const formData = new FormData()
    const buffer = readFileSync(filePath)
    const mimeType = getMimeType(filePath)
    const file = new Blob([buffer], { type: mimeType })
    formData.append('file', file, basename(filePath))
    formData.append('entityType', 'trip')
    formData.append('entityId', tripId)
    formData.append('placement', placement)

    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }

    const url = `${this.baseUrl}/api/upload`
    const headers: Record<string, string> = {}
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const maxRetries = 3
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`HTTP ${response.status}: ${text}`)
        }

        const result = (await response.json())
        return result.url || result.dbRecord?.url || result.dbRecord?.path || ''
      }
      catch (err) {
        lastError = err
        const isSocketOrNetworkError = getErrorMessage(err)?.includes('socket connection was closed')
          || getErrorMessage(err)?.includes('ECONNRESET')
          || getErrorMessage(err)?.includes('ETIMEDOUT')
          || getErrorCode(err) === 'ECONNRESET'

        if (attempt < maxRetries && isSocketOrNetworkError) {
          const backoff = (attempt + 1) * 750
          await new Promise(resolve => setTimeout(resolve, backoff))
          continue
        }
        throw err
      }
    }

    throw lastError
  }

  async uploadDocument(
    tripId: string,
    filePath: string,
    metadata?: {
      access?: 'public' | 'private'
      folderId?: string | null
      title?: string | null
      category?: string | null
    },
  ): Promise<string> {
    return this.uploadImage(tripId, filePath, 'documents', {
      access: 'private',
      ...metadata,
    })
  }

  async listDocuments(tripId: string): Promise<ImportDocument[]> {
    try {
      const input = encodeURIComponent(JSON.stringify({ tripId }))
      const res = await this.request<{ result?: { data: ImportDocument[] } } | ImportDocument[]>(`/trpc/image.listDocuments?input=${input}`, { method: 'GET' })
      return Array.isArray(res) ? res : res.result?.data || []
    }
    catch {
      return []
    }
  }

  async updateDocumentMeta(
    id: string,
    metadata: {
      folderId?: string | null
      access?: 'public' | 'private'
      title?: string | null
      category?: string | null
      isFavorite?: boolean
      note?: string | null
    },
  ): Promise<unknown> {
    const res = await this.request<unknown>('/trpc/image.updateDocumentMeta', {
      method: 'POST',
      body: JSON.stringify({ id, metadata }),
    })
    return isRecord(res) && isRecord(res.result) ? res.result.data : res
  }
}
