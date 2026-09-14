import type { ActivityPayload } from '../types'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

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

  constructor(apiUrl: string) {
    this.baseUrl = apiUrl.replace(/\/+$/, '')
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
    let lastError: any

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        })

        const text = await response.text()
        let data: any
        try {
          data = JSON.parse(text)
        }
        catch {
          data = text
        }

        if (!response.ok) {
          const errorMsg = typeof data === 'object' && data?.message
            ? data.message
            : (typeof data === 'object' && data?.error ? JSON.stringify(data.error) : `HTTP ${response.status}: ${text}`)
          throw new Error(errorMsg)
        }

        return data as T
      }
      catch (err: any) {
        lastError = err
        const isSocketOrNetworkError = err?.message?.includes('socket connection was closed')
          || err?.message?.includes('ECONNRESET')
          || err?.message?.includes('ETIMEDOUT')
          || err?.code === 'ECONNRESET'

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

  // 1. Auth: SignIn
  async signIn(email: string, password: string): Promise<{ accessToken: string, user: any }> {
    try {
      const res = await this.request<any>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (res?.token?.accessToken) {
        this.setToken(res.token.accessToken)
        return { accessToken: res.token.accessToken, user: res.user }
      }
    }
    catch (err: any) {
      try {
        const trpcRes = await this.request<any>('/trpc/user.signIn', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        const result = trpcRes?.result?.data || trpcRes
        if (result?.token?.accessToken) {
          this.setToken(result.token.accessToken)
          return { accessToken: result.token.accessToken, user: result.user }
        }
      }
      catch {
        // ignore
      }
      throw new Error(`Ошибка авторизации: ${err.message}`)
    }

    throw new Error('Не удалось получить accessToken при входе')
  }

  // 2. Trip Endpoints
  async createTrip(payload: {
    title: string
    description?: string
    startDate?: string
    endDate?: string
  }): Promise<{ id: string, title: string, startDate: string, endDate: string }> {
    return await this.request<any>('/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateTrip(id: string, details: {
    title?: string
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
  }): Promise<any> {
    return await this.request<any>(`/trips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, details }),
    })
  }

  async getTrips(tab: 'my' | 'public' = 'my'): Promise<Array<{ id: string, title: string, startDate?: string, endDate?: string, status?: string, cities?: string[], days?: any[] }>> {
    return await this.request<any>(`/trips?tab=${tab}`, {
      method: 'GET',
    })
  }

  async getTripById(tripId: string): Promise<any> {
    return await this.request<any>(`/trips/${tripId}`, {
      method: 'GET',
    })
  }

  async deleteTrip(tripId: string): Promise<any> {
    return await this.request<any>(`/trips/${tripId}`, { method: 'DELETE' })
  }

  async getTripDetails(tripId: string): Promise<any> {
    try {
      return await this.request<any>(`/trips/${tripId}/details`, {
        method: 'GET',
      })
    }
    catch {
      return await this.request<any>(`/trips/${tripId}`, {
        method: 'GET',
      })
    }
  }

  // 3. Trip Sections (Tabs: Bookings, Checklist, Finances, Memories, Notes, Documents)
  async createTripSection(payload: {
    tripId: string
    type: 'bookings' | 'checklist' | 'finances' | 'memories' | 'notes' | 'documents'
    title: string
    icon?: string | null
    content?: any
  }): Promise<any> {
    try {
      return await this.request<any>('/trip-sections', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
    catch {
      return await this.request<any>('/trpc/tripSection.create', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
  }

  async updateTripSection(id: string, payload: {
    title?: string
    icon?: string | null
    content?: any
  }): Promise<any> {
    try {
      return await this.request<any>(`/trip-sections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ id, ...payload }),
      })
    }
    catch {
      return await this.request<any>('/trpc/tripSection.update', {
        method: 'POST',
        body: JSON.stringify({ id, ...payload }),
      })
    }
  }

  async getDaysByTripId(tripId: string): Promise<Array<{ id: string, date: string, title: string, activities?: Array<{ id: string, title: string, startTime: string, endTime: string, sections?: Array<{ id: string, type: string }> }> }>> {
    return await this.request<any>(`/days/by-trip/${tripId}`, {
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
    return await this.request<any>('/days', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateDay(id: string, details: {
    title?: string
    description?: string | null
    note?: string | null
    meta?: any[]
    date?: string
  }): Promise<any> {
    return await this.request<any>(`/days/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, details }),
    })
  }

  async deleteDay(id: string): Promise<any> {
    return await this.request<any>(`/days/${id}`, {
      method: 'DELETE',
    })
  }

  async generateDayTemplate(dayId: string, payload: {
    prompt: string
    currentActivities: any[]
    canvasNote: string
    daysContext?: any
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
    sections?: any[]
  }): Promise<any> {
    return await this.request<any>('/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateActivity(payload: {
    id: string
    dayId: string
    title: string
    startTime: string
    endTime: string
    tag?: string
    sections?: any[]
  }): Promise<any> {
    return await this.request<any>(`/activities/${payload.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async deleteActivity(id: string): Promise<any> {
    return await this.request<any>(`/activities/${id}`, {
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
    return await this.request<any>('/notes', {
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
  }): Promise<any> {
    return await this.request<any>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, ...payload }),
    })
  }

  async getNotesByTripId(tripId: string): Promise<Array<{ id: string, parentId?: string | null, type: string, title: string }>> {
    return await this.request<any>(`/notes/by-trip/${tripId}`, { method: 'GET' })
  }

  // 7. Image & Document Upload Endpoint
  async uploadImage(
    tripId: string,
    filePath: string,
    placement: 'route' | 'memories' | 'notes' | 'documents' = 'route',
    metadata?: Record<string, any>,
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
    let lastError: any

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

        const result = (await response.json()) as any
        return result.url || result.dbRecord?.url || result.dbRecord?.path || ''
      }
      catch (err: any) {
        lastError = err
        const isSocketOrNetworkError = err?.message?.includes('socket connection was closed')
          || err?.message?.includes('ECONNRESET')
          || err?.message?.includes('ETIMEDOUT')
          || err?.code === 'ECONNRESET'

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

  async listDocuments(tripId: string): Promise<Array<{
    id: string
    tripId: string
    url: string
    originalName: string
    sizeBytes: number
    metadata?: any
  }>> {
    try {
      const input = encodeURIComponent(JSON.stringify({ tripId }))
      const res = await this.request<any>(`/trpc/image.listDocuments?input=${input}`, { method: 'GET' })
      return res?.result?.data || (Array.isArray(res) ? res : [])
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
  ): Promise<any> {
    const res = await this.request<any>('/trpc/image.updateDocumentMeta', {
      method: 'POST',
      body: JSON.stringify({ id, metadata }),
    })
    return res?.result?.data ?? res
  }
}
