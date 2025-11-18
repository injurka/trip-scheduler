import type { IAuthRepository } from '../model/types'
import type { SignInPayload, SignUpPayload, TelegramAuthPayload, User } from '~/shared/types/models/auth'
import { trpc } from '~/shared/services/trpc/trpc.service'
import { TOKEN_KEY } from '~/shared/store/auth.store'
import { throttle } from '../lib/decorators'

export class AuthRepository implements IAuthRepository {
  @throttle(1000)
  async signUp(payload: SignUpPayload) {
    return trpc.user.signUp.mutate(payload)
  }

  @throttle(1000)
  async verifyEmail(payload: { email: string, token: string }) {
    return trpc.user.verifyEmail.mutate(payload)
  }

  @throttle(1000)
  async signIn(payload: SignInPayload) {
    return trpc.user.signIn.mutate(payload)
  }

  @throttle(1000)
  async signOut() {
    await trpc.user.signOut.mutate()
  }

  @throttle(1000)
  async signInWithTelegram(authData: TelegramAuthPayload) { // Убедитесь, что тип здесь - объект
    return trpc.user.signInWithTelegram.mutate(authData) // Передаем объект
  }

  @throttle(1000)
  async refresh(refreshToken: string) {
    return trpc.user.refresh.mutate({ refreshToken })
  }

  @throttle(500)
  async me() {
    return trpc.user.me.query()
  }

  async updateStatus(data: { statusText?: string | null, statusEmoji?: string | null }): Promise<User> {
    const result = await trpc.user.updateStatus.mutate(data)
    return result as User
  }

  async updateUser(data: { name?: string, avatarUrl?: string }): Promise<User> {
    const result = await trpc.user.update.mutate(data)
    return result as User
  }

  @throttle(1000)
  async uploadAvatar(file: File): Promise<User> {
    const formData = new FormData()
    formData.append('file', file) // Используем 'file', как ожидает сервер

    const accessToken = useStorage<string | null>(TOKEN_KEY, null)

    const response = await fetch(`${import.meta.env.VITE_APP_SERVER_URL}/api/avatar/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Ошибка при загрузке аватара.')
    }

    return response.json()
  }
}
