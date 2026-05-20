import type { GitHubEmail, GitHubUser, GoogleUser } from '~/models/auth'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { authUtils } from '~/lib/auth.utils'
import { userRepository } from '~/repositories/user.repository'
import { db } from '~/../db'
import { users } from '~/../db/schema'
import { FREE_PLAN_ID } from '~/lib/constants'

interface OAuthInput {
  provider: 'google' | 'github'
  providerId: string
  email: string | null
  name: string
  avatarUrl?: string
}

export class OAuthService {
  constructor(private readonly userRepo: typeof userRepository) { }

  public async handleGoogle(code: string) {
    const tokenData = await this.exchangeGoogleCodeForToken(code)
    const userInfo = await this.getGoogleUserInfo(tokenData.access_token)
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

  public async handleGithub(code: string) {
    const tokenData = await this.exchangeGithubCodeForToken(code)
    const userInfo = await this.getGithubUserInfo(tokenData.access_token)
    const primaryEmail = await this.getGithubUserPrimaryEmail(tokenData.access_token)

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

  private async findOrCreateFromOAuth({ provider, providerId, email, name, avatarUrl }: OAuthInput) {
    let user: Awaited<ReturnType<typeof db.query.users.findFirst>> | undefined

    if (provider === 'google') {
      user = await db.query.users.findFirst({ where: eq(users.googleId, providerId), with: { plan: true } })
    }
    else if (provider === 'github') {
      user = await db.query.users.findFirst({ where: eq(users.githubId, providerId), with: { plan: true } })
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
}

export const oAuthService = new OAuthService(userRepository)