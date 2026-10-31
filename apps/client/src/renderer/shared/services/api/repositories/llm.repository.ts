import type { ChecklistMatchResponse, GeneratedBooking, GeneratedTransaction, ILLMRepository } from '../model/types'
import { SERVER_URL } from '~/shared/lib/env'
import { refreshTokensIfNeeded } from '~/shared/services/trpc/auth-token.service'
import { TOKEN_KEY, useAuthStore } from '~/shared/store/auth.store'

export class LLMRepository implements ILLMRepository {
  private async sendAuthorizedFormData<T>(endpoint: string, formData: FormData, defaultErrorMsg: string): Promise<T> {
    const authStore = useAuthStore()
    let accessToken = authStore.tokenPair?.accessToken || localStorage.getItem(TOKEN_KEY)

    let response = await fetch(`${SERVER_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.status === 401) {
      const refreshed = await refreshTokensIfNeeded()

      if (refreshed) {
        accessToken = authStore.tokenPair?.accessToken || localStorage.getItem(TOKEN_KEY)
        response = await fetch(`${SERVER_URL}${endpoint}`, {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      }
    }

    if (!response.ok) {
      let message = defaultErrorMsg

      try {
        const errorData = await response.json()
        message = errorData.message || defaultErrorMsg
      }
      catch {
        // ignore JSON parse error
      }

      throw new Error(message)
    }

    return response.json()
  }

  async generateBookingFromData(formData: FormData): Promise<GeneratedBooking> {
    return this.sendAuthorizedFormData<GeneratedBooking>('/api/llm/booking/generate', formData, 'Ошибка при генерации бронирования.')
  }

  async generateFinancesFromData(formData: FormData): Promise<GeneratedTransaction[]> {
    return this.sendAuthorizedFormData<GeneratedTransaction[]>('/api/llm/finances/generate', formData, 'Ошибка при генерации транзакций.')
  }

  async matchChecklistFromData(formData: FormData): Promise<ChecklistMatchResponse> {
    return this.sendAuthorizedFormData<ChecklistMatchResponse>('/api/llm/checklist/match', formData, 'Ошибка при проверке чек-листа.')
  }

  async transcribeChecklistVoice(formData: FormData): Promise<{ text: string }> {
    return this.sendAuthorizedFormData<{ text: string }>('/api/llm/checklist/transcribe', formData, 'Ошибка при распознавании голоса.')
  }
}
