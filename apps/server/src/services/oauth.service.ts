import type { GitHubEmail, GitHubUser, GoogleUser, TelegramAuthPayload } from '~/models/auth'
import { createHash, createHmac } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { authUtils } from '~/lib/auth.utils'
import { userRepository } from '~/repositories/user.repository'

export class OAuthService {
  constructor(private readonly userRepo: typeof userRepository) { }

  public async handleGoogle(code: string) {
    const tokenData = await this.exchangeGoogleCodeForToken(code)
    const userInfo = await this.getGoogleUserInfo(tokenData.access_token)
    const user = await this.userRepo.findOrCreateFromOAuth({
      provider: 'google',
      providerId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.picture,
    })
    const token = await authUtils.generateTokens({ id: user.id, email: user.email! })
    return { token, user }
  }

  public async handleGithub(code: string) {
    const tokenData = await this.exchangeGithubCodeForToken(code)
    const userInfo = await this.getGithubUserInfo(tokenData.access_token)
    const primaryEmail = await this.getGithubUserPrimaryEmail(tokenData.access_token)

    const user = await this.userRepo.findOrCreateFromOAuth({
      provider: 'github',
      providerId: userInfo.id.toString(),
      email: primaryEmail,
      name: userInfo.name || userInfo.login,
      avatarUrl: userInfo.avatar_url,
    })

    const token = await authUtils.generateTokens({ id: user.id, email: user.email! })

    return { token, user }
  }

  public async handleTelegram(authData: TelegramAuthPayload) {
    const botToken = import.meta.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('Ошибка: Переменная окружения TELEGRAM_BOT_TOKEN не установлена.')
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Telegram Bot Token не настроен на сервере.' })
    }
    try {
      const { hash, ...dataToCheck } = authData
      if (!hash) {
        throw new Error('Параметр hash отсутствует в данных авторизации.')
      }

      const dataCheckString = Object.keys(dataToCheck)
        .sort()
        .map((key) => {
          const value = (dataToCheck as any)[key]
          return `${key}=${value}`
        })
        .join('\n')
      const secretKey = createHash('sha256').update(botToken).digest()

      const calculatedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex')

      if (calculatedHash !== hash) {
        console.error('--- ОШИБКА ПРОВЕРКИ ХЕША TELEGRAM ---')
        console.error('Ожидаемый хеш:', hash)
        console.error('Вычисленный хеш:', calculatedHash)
        console.error('Строка для проверки:', dataCheckString)
        console.error('Secret key (hex):', secretKey.toString('hex'))
        console.error('------------------------------------')
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Данные от Telegram не прошли проверку: неверный хэш.' })
      }

      const authDate = new Date(authData.auth_date * 1000)
      if (Date.now() - authDate.getTime() > 24 * 60 * 60 * 1000) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Данные от Telegram устарели.' })
      }

      const user = await this.userRepo.findOrCreateFromOAuth({
        provider: 'telegram',
        providerId: authData.id.toString(),
        email: null,
        name: `${authData.first_name} ${authData.last_name || ''}`.trim(),
        avatarUrl: authData.photo_url,
      })

      const token = await authUtils.generateTokens({ id: user.id, email: user.email! })

      return { token, user }
    }
    catch (error: any) {
      console.error('--- Ошибка верификации данных Telegram ---')
      console.error(error)
      throw new TRPCError({ code: 'UNAUTHORIZED', message: error.message || 'Данные от Telegram не прошли проверку.' })
    }
  }

  // Методы для взаимодействия с API Google
  private async exchangeGoogleCodeForToken(code: string): Promise<{ access_token: string }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
        grant_type: 'authorization_code',
      }),
    })
    if (!response.ok)
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to exchange Google code' })

    return response.json()
  }

  private async getGoogleUserInfo(accessToken: string): Promise<GoogleUser> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok)
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch Google user info' })
    return response.json()
  }

  // Методы для взаимодействия с API GitHub
  private async exchangeGithubCodeForToken(code: string): Promise<{ access_token: string }> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        redirect_uri: process.env.GITHUB_CALLBACK_URL!,
      }),
    })
    if (!response.ok)
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to exchange GitHub code' })
    return response.json()
  }

  private async getGithubUserInfo(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (!response.ok)
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch GitHub user info' })
    return response.json()
  }

  private async getGithubUserPrimaryEmail(accessToken: string): Promise<string | null> {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (!response.ok)
      return null
    const emails: GitHubEmail[] = await response.json()
    return emails.find(e => e.primary && e.verified)?.email ?? null
  }
}

export const oAuthService = new OAuthService(userRepository)
