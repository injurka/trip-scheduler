import type { GeneratedBooking, GeneratedTransaction, ILLMRepository } from '../model/types'
import { refreshTokensIfNeeded } from '~/shared/services/trpc/auth-token.service'
import { TOKEN_KEY, useAuthStore } from '~/shared/store/auth.store'

export class LLMRepository implements ILLMRepository {
  async generateBookingFromData(formData: FormData): Promise<GeneratedBooking> {
    const authStore = useAuthStore()
    let accessToken = authStore.tokenPair?.accessToken || localStorage.getItem(TOKEN_KEY)

    let response = await fetch(`${import.meta.env.VITE_APP_SERVER_URL}/api/llm/booking/generate`, {
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
        response = await fetch(`${import.meta.env.VITE_APP_SERVER_URL}/api/llm/booking/generate`, {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      }
    }

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Ошибка при генерации бронирования.')
    }

    return response.json()
  }

  async generateFinancesFromData(formData: FormData): Promise<GeneratedTransaction[]> {
    const authStore = useAuthStore()
    let accessToken = authStore.tokenPair?.accessToken || localStorage.getItem(TOKEN_KEY)

    let response = await fetch(`${import.meta.env.VITE_APP_SERVER_URL}/api/llm/finances/generate`, {
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
        response = await fetch(`${import.meta.env.VITE_APP_SERVER_URL}/api/llm/finances/generate`, {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      }
    }

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Ошибка при генерации транзакций.')
    }

    return response.json()
  }
}
