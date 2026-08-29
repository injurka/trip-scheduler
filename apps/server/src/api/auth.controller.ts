import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { authUtils } from '~/lib/auth.utils'
import { Logger } from '~/lib/logger'
import { oAuthService } from '~/services/oauth.service'
import { telegramAuthService } from '~/services/telegram-auth.service'

const logger = new Logger()
const authController = new Hono()

// --- GOOGLE ---
authController.get('/google/login', async (c) => {
  const linkToken = c.req.query('linkToken')
  let linkUserId: string | null = null
  if (linkToken) {
    const payload = await authUtils.verifyToken(linkToken)
    if (payload?.id) {
      linkUserId = payload.id
    }
  }

  const state = crypto.randomUUID()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  url.searchParams.set('redirect_uri', process.env.GOOGLE_CALLBACK_URL!)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)

  const cookiePayload = JSON.stringify({ state, linkUserId })
  setCookie(c, 'oauth_state', cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'Lax',
    maxAge: 600,
  })
  return c.redirect(url.toString())
})

authController.get('/google/callback', async (c) => {
  const { code, state } = c.req.query()
  const savedStateCookie = getCookie(c, 'oauth_state')

  if (!state || !savedStateCookie)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  let savedState = savedStateCookie
  let linkUserId: string | null = null

  try {
    const parsed = JSON.parse(savedStateCookie)
    savedState = parsed.state
    linkUserId = parsed.linkUserId || null
  }
  catch {
    // fallback if state was plain string
  }

  if (state !== savedState)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  setCookie(c, 'oauth_state', '', { expires: new Date(0) })

  if (linkUserId) {
    try {
      await oAuthService.handleGoogle(code!, linkUserId)
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_success', 'google_linked')
      return c.redirect(redirectUrl.toString())
    }
    catch (error: any) {
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_error', error?.message || 'Не удалось привязать Google аккаунт')
      return c.redirect(redirectUrl.toString())
    }
  }

  const result = await oAuthService.handleGoogle(code!)
  const { token } = result as { token: any, user: any }
  const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`)
  redirectUrl.searchParams.set('token', token.accessToken)
  redirectUrl.searchParams.set('refreshToken', token.refreshToken)

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
  let linkUserId: string | null = null
  if (linkToken) {
    const payload = await authUtils.verifyToken(linkToken)
    if (payload?.id) {
      linkUserId = payload.id
    }
  }

  const state = crypto.randomUUID()
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!)
  url.searchParams.set('redirect_uri', process.env.GITHUB_CALLBACK_URL!)
  url.searchParams.set('scope', 'read:user user:email')
  url.searchParams.set('state', state)

  const cookiePayload = JSON.stringify({ state, linkUserId })
  setCookie(c, 'oauth_state', cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'Lax',
    maxAge: 600,
  })
  return c.redirect(url.toString())
})

authController.get('/github/callback', async (c) => {
  const { code, state } = c.req.query()
  const savedStateCookie = getCookie(c, 'oauth_state')

  if (!state || !savedStateCookie)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  let savedState = savedStateCookie
  let linkUserId: string | null = null

  try {
    const parsed = JSON.parse(savedStateCookie)
    savedState = parsed.state
    linkUserId = parsed.linkUserId || null
  }
  catch {
    // fallback if state was plain string
  }

  if (state !== savedState)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  setCookie(c, 'oauth_state', '', { expires: new Date(0) })

  if (linkUserId) {
    try {
      await oAuthService.handleGithub(code!, linkUserId)
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_success', 'github_linked')
      return c.redirect(redirectUrl.toString())
    }
    catch (error: any) {
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_error', error?.message || 'Не удалось привязать GitHub аккаунт')
      return c.redirect(redirectUrl.toString())
    }
  }

  const result = await oAuthService.handleGithub(code!)
  const { token } = result as { token: any, user: any }
  const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`)
  redirectUrl.searchParams.set('token', token.accessToken)
  redirectUrl.searchParams.set('refreshToken', token.refreshToken)

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
  let linkUserId: string | null = null
  if (linkToken) {
    const payload = await authUtils.verifyToken(linkToken)
    if (payload?.id) {
      linkUserId = payload.id
    }
  }

  const state = crypto.randomUUID()
  const url = new URL('https://oauth.yandex.ru/authorize')
  url.searchParams.set('client_id', process.env.YANDEX_CLIENT_ID!)
  const redirectUri = process.env.YANDEX_CALLBACK_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/auth/yandex/callback` : '')
  if (redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri)
  }
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)

  const cookiePayload = JSON.stringify({ state, linkUserId })
  setCookie(c, 'oauth_state', cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'Lax',
    maxAge: 600,
  })
  return c.redirect(url.toString())
})

authController.get('/yandex/callback', async (c) => {
  const { code, state } = c.req.query()
  const savedStateCookie = getCookie(c, 'oauth_state')

  if (!state || !savedStateCookie)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  let savedState = savedStateCookie
  let linkUserId: string | null = null

  try {
    const parsed = JSON.parse(savedStateCookie)
    savedState = parsed.state
    linkUserId = parsed.linkUserId || null
  }
  catch {
    // fallback if state was plain string
  }

  if (state !== savedState)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  setCookie(c, 'oauth_state', '', { expires: new Date(0) })

  if (linkUserId) {
    try {
      await oAuthService.handleYandex(code!, linkUserId)
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_success', 'yandex_linked')
      return c.redirect(redirectUrl.toString())
    }
    catch (error: any) {
      const redirectUrl = new URL(`${process.env.FRONTEND_URL}/user/${linkUserId}/settings`)
      redirectUrl.searchParams.set('oauth_error', error?.message || 'Не удалось привязать Яндекс аккаунт')
      return c.redirect(redirectUrl.toString())
    }
  }

  const result = await oAuthService.handleYandex(code!)
  const { token } = result as { token: any, user: any }
  const redirectUrl = new URL(`${process.env.FRONTEND_URL}/auth/callback`)
  redirectUrl.searchParams.set('token', token.accessToken)
  redirectUrl.searchParams.set('refreshToken', token.refreshToken)

  setCookie(c, 'refresh_token', token.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
  })

  return c.redirect(redirectUrl.toString())
})

authController.post('/telegram/init', (c) => {
  const session = telegramAuthService.initAuth()
  return c.json(session)
})

authController.get('/telegram/status', async (c) => {
  const { token } = c.req.query()
  if (!token)
    throw new HTTPException(400, { message: 'Token is required' })

  const result = await telegramAuthService.getStatus(token)
  if (result.status === 'confirmed' && result.token) {
    setCookie(c, 'refresh_token', result.token.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7,
    })
  }
  return c.json(result)
})

authController.post('/telegram/webhook', async (c) => {
  const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token')
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && secretHeader !== expectedSecret) {
    logger.warn(`[TelegramAuth] Webhook отклонен (401): неверный секретный токен (header: "${secretHeader}")`)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const update = await c.req.json()
    await telegramAuthService.handleUpdate(update)
    return c.json({ ok: true })
  }
  catch (err) {
    logger.error('[TelegramAuth] Ошибка обработки webhook:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

export { authController }
