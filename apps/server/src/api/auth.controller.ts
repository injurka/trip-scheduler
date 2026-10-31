import type { Context } from 'hono'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { authUtils } from '~/lib/auth.utils'
import { oAuthService } from '~/services/oauth.service'

const authController = new Hono()

interface OAuthTransaction {
  linkUserId: string | null
  redirectType: string | null
  clientState: string | null
  clearCookie: boolean
}

async function startOAuthTransaction(
  c: Context,
  linkUserId: string | null,
  redirectType: string | undefined,
): Promise<string> {
  const clientState = c.req.query('client_state')

  if (redirectType === 'app' && clientState && !/^[\w-]{20,128}$/.test(clientState)) {
    throw new HTTPException(400, { message: 'Invalid client OAuth state.' })
  }

  const isClientStateFlow = redirectType === 'app' && Boolean(clientState)
  const state = redirectType === 'app' && clientState
    ? await authUtils.createOAuthState(clientState, linkUserId)
    : crypto.randomUUID()

  if (!isClientStateFlow) {
    setCookie(c, 'oauth_state', JSON.stringify({ state, linkUserId, redirectType }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'Lax',
      maxAge: 600,
    })
  }

  return state
}

async function readOAuthTransaction(c: Context, state: string | undefined): Promise<OAuthTransaction | null> {
  if (!state)
    return null

  const mobileState = await authUtils.verifyOAuthState(state)
  if (mobileState) {
    return {
      linkUserId: mobileState.linkUserId,
      redirectType: 'app',
      clientState: mobileState.clientState,
      clearCookie: false,
    }
  }

  const savedStateCookie = getCookie(c, 'oauth_state')
  if (!savedStateCookie)
    return null

  let savedState = savedStateCookie
  let linkUserId: string | null = null
  let redirectType: string | null = null

  try {
    const parsed = JSON.parse(savedStateCookie)
    savedState = parsed.state
    linkUserId = parsed.linkUserId || null
    redirectType = parsed.redirectType || null
  }
  catch {
    // Keep compatibility with the previous plain-string cookie format.
  }

  if (state !== savedState)
    return null

  return { linkUserId, redirectType, clientState: null, clearCookie: true }
}

function clearOAuthStateCookie(c: Context, transaction: OAuthTransaction) {
  if (transaction.clearCookie)
    setCookie(c, 'oauth_state', '', { path: '/', expires: new Date(0) })
}

function addClientStateToRedirect(redirectUrl: URL, transaction: OAuthTransaction) {
  if (transaction.redirectType === 'app' && transaction.clientState)
    redirectUrl.searchParams.set('oauth_state', transaction.clientState)
}

// --- GOOGLE ---
authController.get('/google/login', async (c) => {
  const linkToken = c.req.query('linkToken')
  const redirectType = c.req.query('redirect_type') // 'app' | 'deep_link'
  let linkUserId: string | null = null
  if (linkToken) {
    const payload = await authUtils.verifyToken(linkToken)
    if (payload?.id) {
      linkUserId = payload.id
    }
  }

  const state = await startOAuthTransaction(c, linkUserId, redirectType)
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  url.searchParams.set('redirect_uri', process.env.GOOGLE_CALLBACK_URL!)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)

  return c.redirect(url.toString())
})

authController.get('/google/callback', async (c) => {
  const { code, state } = c.req.query()
  const transaction = await readOAuthTransaction(c, state)

  if (!transaction)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  const { linkUserId, redirectType } = transaction
  clearOAuthStateCookie(c, transaction)

  if (linkUserId) {
    try {
      await oAuthService.handleGoogle(code!, linkUserId)
      const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://user/settings' : `${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_success', 'google_linked')
      addClientStateToRedirect(redirectUrl, transaction)
      return c.redirect(redirectUrl.toString())
    }
    catch (error: any) {
      const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://user/settings' : `${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_error', error?.message || 'Не удалось привязать Google аккаунт')
      addClientStateToRedirect(redirectUrl, transaction)
      return c.redirect(redirectUrl.toString())
    }
  }

  const result = await oAuthService.handleGoogle(code!)
  const { token } = result as { token: any, user: any }
  const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://auth/callback' : `${process.env.FRONTEND_URL}/auth/callback`)
  redirectUrl.searchParams.set('token', token.accessToken)
  redirectUrl.searchParams.set('refreshToken', token.refreshToken)
  addClientStateToRedirect(redirectUrl, transaction)

  setCookie(c, 'refresh_token', token.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
  })

  return c.redirect(redirectUrl.toString())
})

// --- GITHUB ---
authController.get('/github/login', async (c) => {
  const linkToken = c.req.query('linkToken')
  const redirectType = c.req.query('redirect_type') // 'app' | 'deep_link'
  let linkUserId: string | null = null
  if (linkToken) {
    const payload = await authUtils.verifyToken(linkToken)
    if (payload?.id) {
      linkUserId = payload.id
    }
  }

  const state = await startOAuthTransaction(c, linkUserId, redirectType)
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!)
  url.searchParams.set('redirect_uri', process.env.GITHUB_CALLBACK_URL!)
  url.searchParams.set('scope', 'read:user user:email')
  url.searchParams.set('state', state)

  return c.redirect(url.toString())
})

authController.get('/github/callback', async (c) => {
  const { code, state } = c.req.query()
  const transaction = await readOAuthTransaction(c, state)

  if (!transaction)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  const { linkUserId, redirectType } = transaction
  clearOAuthStateCookie(c, transaction)

  if (linkUserId) {
    try {
      await oAuthService.handleGithub(code!, linkUserId)
      const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://user/settings' : `${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_success', 'github_linked')
      addClientStateToRedirect(redirectUrl, transaction)
      return c.redirect(redirectUrl.toString())
    }
    catch (error: any) {
      const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://user/settings' : `${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_error', error?.message || 'Не удалось привязать GitHub аккаунт')
      addClientStateToRedirect(redirectUrl, transaction)
      return c.redirect(redirectUrl.toString())
    }
  }

  const result = await oAuthService.handleGithub(code!)
  const { token } = result as { token: any, user: any }
  const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://auth/callback' : `${process.env.FRONTEND_URL}/auth/callback`)
  redirectUrl.searchParams.set('token', token.accessToken)
  redirectUrl.searchParams.set('refreshToken', token.refreshToken)
  addClientStateToRedirect(redirectUrl, transaction)

  setCookie(c, 'refresh_token', token.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
  })

  return c.redirect(redirectUrl.toString())
})

// --- YANDEX ---
authController.get('/yandex', c => c.redirect('/api/auth/yandex/login'))

authController.get('/yandex/login', async (c) => {
  const linkToken = c.req.query('linkToken')
  const redirectType = c.req.query('redirect_type') // 'app' | 'deep_link'
  let linkUserId: string | null = null
  if (linkToken) {
    const payload = await authUtils.verifyToken(linkToken)
    if (payload?.id) {
      linkUserId = payload.id
    }
  }

  const state = await startOAuthTransaction(c, linkUserId, redirectType)
  const url = new URL('https://oauth.yandex.ru/authorize')
  url.searchParams.set('client_id', process.env.YANDEX_CLIENT_ID!)
  const redirectUri = process.env.YANDEX_CALLBACK_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/auth/yandex/callback` : '')
  if (redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri)
  }
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)

  return c.redirect(url.toString())
})

authController.get('/yandex/callback', async (c) => {
  const { code, state } = c.req.query()
  const transaction = await readOAuthTransaction(c, state)

  if (!transaction)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  const { linkUserId, redirectType } = transaction
  clearOAuthStateCookie(c, transaction)

  if (linkUserId) {
    try {
      await oAuthService.handleYandex(code!, linkUserId)
      const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://user/settings' : `${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_success', 'yandex_linked')
      addClientStateToRedirect(redirectUrl, transaction)
      return c.redirect(redirectUrl.toString())
    }
    catch (error: any) {
      const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://user/settings' : `${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_error', error?.message || 'Не удалось привязать Яндекс аккаунт')
      addClientStateToRedirect(redirectUrl, transaction)
      return c.redirect(redirectUrl.toString())
    }
  }

  const result = await oAuthService.handleYandex(code!)
  const { token } = result as { token: any, user: any }
  const redirectUrl = new URL(redirectType === 'app' ? 'trip-scheduler://auth/callback' : `${process.env.FRONTEND_URL}/auth/callback`)
  redirectUrl.searchParams.set('token', token.accessToken)
  redirectUrl.searchParams.set('refreshToken', token.refreshToken)
  addClientStateToRedirect(redirectUrl, transaction)

  setCookie(c, 'refresh_token', token.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
  })

  return c.redirect(redirectUrl.toString())
})

export { authController }
