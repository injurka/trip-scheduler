import type { ActivityPayload } from '../types'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

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
    cities?: string[]
    tags?: string[]
    status?: 'planned' | 'draft' | 'completed'
    visibility?: 'private' | 'public'
    startDate?: string
    endDate?: string
  }): Promise<any> {
    return await this.request<any>(`/trips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id, details }),
    })
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

  async getDaysByTripId(tripId: string): Promise<Array<{ id: string, date: string, title: string }>> {
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

  // 5. Activity Endpoints
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

  // 7. Image Upload Endpoint
  async uploadImage(
    tripId: string,
    filePath: string,
    placement: 'route' | 'memories' | 'notes' | 'documents' = 'route',
  ): Promise<string> {
    const formData = new FormData()
    const buffer = readFileSync(filePath)
    const file = new Blob([buffer])
    formData.append('file', file, basename(filePath))
    formData.append('entityType', 'trip')
    formData.append('entityId', tripId)
    formData.append('placement', placement)

    const url = `${this.baseUrl}/api/upload`
    const headers: Record<string, string> = {}
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

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
}
