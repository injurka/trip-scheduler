import type { GitHubEmail, GitHubUser, GoogleUser, YandexUser } from '~/models/auth'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { db } from '~/../db'
import { users } from '~/../db/schema'
import { authUtils } from '~/lib/auth.utils'
import { FREE_PLAN_ID } from '~/lib/constants'
import { userRepository } from '~/repositories/user.repository'

interface OAuthInput {
  provider: 'google' | 'github' | 'yandex'
  providerId: string
  email: string | null
  name: string
  avatarUrl?: string
}

export class OAuthService {
  constructor(private readonly userRepo: typeof userRepository) { }

  public async handleGoogle(code: string, linkUserId?: string) {
    const tokenData = await this.exchangeGoogleCodeForToken(code)
    const userInfo = await this.getGoogleUserInfo(tokenData.access_token)

    if (linkUserId) {
      const user = await this.userRepo.linkOAuthProvider(linkUserId, 'google', userInfo.sub)
      return { linked: true, provider: 'google', user }
    }

    const user = await this.findOrCreateFromOAuth({
      provider: 'google',
      providerId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.picture,
    })
    const token = await authUtils.generateTokens({ id: user.id, email: user.email! })
    return { token, user }
  }

  public async handleGithub(code: string, linkUserId?: string) {
    const tokenData = await this.exchangeGithubCodeForToken(code)
    const userInfo = await this.getGithubUserInfo(tokenData.access_token)
    const primaryEmail = await this.getGithubUserPrimaryEmail(tokenData.access_token)

    if (linkUserId) {
      const user = await this.userRepo.linkOAuthProvider(linkUserId, 'github', userInfo.id.toString())
      return { linked: true, provider: 'github', user }
    }

    const user = await this.findOrCreateFromOAuth({
      provider: 'github',
      providerId: userInfo.id.toString(),
      email: primaryEmail,
      name: userInfo.name || userInfo.login,
      avatarUrl: userInfo.avatar_url,
    })

    const token = await authUtils.generateTokens({ id: user.id, email: user.email! })

    return { token, user }
  }

  public async handleYandex(code: string, linkUserId?: string) {
    const tokenData = await this.exchangeYandexCodeForToken(code)
    const userInfo = await this.getYandexUserInfo(tokenData.access_token)

    if (linkUserId) {
      const user = await this.userRepo.linkOAuthProvider(linkUserId, 'yandex', String(userInfo.id))
      return { linked: true, provider: 'yandex', user }
    }

    const name = userInfo.real_name
      || userInfo.display_name
      || [userInfo.first_name, userInfo.last_name].filter(Boolean).join(' ')
      || userInfo.login
      || `yandex_${userInfo.id}`

    const avatarUrl = userInfo.default_avatar_id && !userInfo.is_avatar_empty
      ? `https://avatars.yandex.net/get-yapic/${userInfo.default_avatar_id}/islands-200`
      : undefined

    const email = userInfo.default_email || userInfo.emails?.[0] || null

    const user = await this.findOrCreateFromOAuth({
      provider: 'yandex',
      providerId: String(userInfo.id),
      email,
      name,
      avatarUrl,
    })

    const token = await authUtils.generateTokens({ id: user.id, email: user.email! })
    return { token, user }
  }

  private async findOrCreateFromOAuth({ provider, providerId, email, name, avatarUrl }: OAuthInput) {
    let user: Awaited<ReturnType<typeof db.query.users.findFirst>> | undefined

    if (provider === 'google') {
      user = await db.query.users.findFirst({ where: eq(users.googleId, providerId), with: { plan: true } })
    }
    else if (provider === 'github') {
      user = await db.query.users.findFirst({ where: eq(users.githubId, providerId), with: { plan: true } })
    }
    else if (provider === 'yandex') {
      user = await db.query.users.findFirst({ where: eq(users.yandexId, providerId), with: { plan: true } })
    }

    if (user) {
      const { password, ...userWithoutPassword } = user
      return userWithoutPassword
    }

    if (email) {
      const userWithEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
        with: { plan: true },
      })

      if (userWithEmail) {
        const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
        if (provider === 'google')
          updateData.googleId = providerId
        else if (provider === 'github')
          updateData.githubId = providerId
        else if (provider === 'yandex')
          updateData.yandexId = providerId

        const [updatedUser] = await db.update(users)
          .set(updateData)
          .where(eq(users.id, userWithEmail.id))
          .returning()

        const { password, ...userWithoutPassword } = updatedUser
        return { ...userWithoutPassword, plan: userWithEmail.plan }
      }
    }

    const newUserPayload: typeof users.$inferInsert = {
      email: email ?? null,
      name,
      avatarUrl: avatarUrl || undefined,
      emailVerified: email ? new Date() : null,
      planId: FREE_PLAN_ID,
    }

    if (provider === 'google')
      newUserPayload.googleId = providerId
    else if (provider === 'github')
      newUserPayload.githubId = providerId
    else if (provider === 'yandex')
      newUserPayload.yandexId = providerId

    const [newUser] = await db.insert(users)
      .values(newUserPayload)
      .returning()

    const fullUser = await this.userRepo.getById(newUser.id)
    return fullUser!
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

  // Методы для взаимодействия с API Яндекс
  private getYandexCallbackUrl(): string {
    return process.env.YANDEX_CALLBACK_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/auth/yandex/callback` : '')
  }

  private async exchangeYandexCodeForToken(code: string): Promise<{ access_token: string }> {
    const clientId = process.env.YANDEX_CLIENT_ID!
    const clientSecret = process.env.YANDEX_CLIENT_SECRET!
    const redirectUri = this.getYandexCallbackUrl()

    const bodyParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
    }
    if (redirectUri) {
      bodyParams.redirect_uri = redirectUri
    }

    const response = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams(bodyParams).toString(),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to exchange Yandex code: ${errText}` })
    }

    return response.json()
  }

  private async getYandexUserInfo(accessToken: string): Promise<YandexUser> {
    const response = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` },
    })
    if (!response.ok)
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch Yandex user info' })
    return response.json()
  }
}

export const oAuthService = new OAuthService(userRepository)
