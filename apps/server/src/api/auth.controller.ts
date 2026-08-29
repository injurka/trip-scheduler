import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { oAuthService } from '~/services/oauth.service'
import { telegramAuthService } from '~/services/telegram-auth.service'

const authController = new Hono()

// --- GOOGLE ---
authController.get('/google/login', (c) => {
  const state = crypto.randomUUID()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  url.searchParams.set('redirect_uri', process.env.GOOGLE_CALLBACK_URL!)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)

  setCookie(c, 'oauth_state', state, { httpOnly: true, secure: true, path: '/', sameSite: 'Lax', maxAge: 600 })
  return c.redirect(url.toString())
})

authController.get('/google/callback', async (c) => {
  const { code, state } = c.req.query()
  const savedState = getCookie(c, 'oauth_state')

  if (!state || !savedState || state !== savedState)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  setCookie(c, 'oauth_state', '', { expires: new Date(0) })

  const { token } = await oAuthService.handleGoogle(code!)
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
authController.get('/github/login', (c) => {
  const state = crypto.randomUUID()
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!)
  url.searchParams.set('redirect_uri', process.env.GITHUB_CALLBACK_URL!)
  url.searchParams.set('scope', 'read:user user:email')
  url.searchParams.set('state', state)

  setCookie(c, 'oauth_state', state, { httpOnly: true, secure: true, path: '/', sameSite: 'Lax', maxAge: 600 })
  return c.redirect(url.toString())
})

authController.get('/github/callback', async (c) => {
  const { code, state } = c.req.query()
  const savedState = getCookie(c, 'oauth_state')

  if (!state || !savedState || state !== savedState)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  setCookie(c, 'oauth_state', '', { expires: new Date(0) })

  const { token } = await oAuthService.handleGithub(code!)
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

authController.get('/yandex/login', (c) => {
  const state = crypto.randomUUID()
  const url = new URL('https://oauth.yandex.ru/authorize')
  url.searchParams.set('client_id', process.env.YANDEX_CLIENT_ID!)
  const redirectUri = process.env.YANDEX_CALLBACK_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/auth/yandex/callback` : '')
  if (redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri)
  }
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)

  setCookie(c, 'oauth_state', state, { httpOnly: true, secure: true, path: '/', sameSite: 'Lax', maxAge: 600 })
  return c.redirect(url.toString())
})

authController.get('/yandex/callback', async (c) => {
  const { code, state } = c.req.query()
  const savedState = getCookie(c, 'oauth_state')

  if (!state || !savedState || state !== savedState)
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })

  setCookie(c, 'oauth_state', '', { expires: new Date(0) })

  const { token } = await oAuthService.handleYandex(code!)
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
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const update = await c.req.json()
  await telegramAuthService.handleUpdate(update)
  return c.json({ ok: true })
})

export { authController }
