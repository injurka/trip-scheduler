import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { oAuthService } from '~/services/oauth.service'

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

  setCookie(c, 'oauth_state', state, { httpOnly: true, secure: true, path: '/', sameSite: 'Lax', maxAge: 600 }) // 10 минут

  return c.redirect(url.toString())
})

authController.get('/google/callback', async (c) => {
  const { code, state } = c.req.query()
  const savedState = getCookie(c, 'oauth_state')

  if (!state || !savedState || state !== savedState) {
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })
  }

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
    maxAge: 60 * 60 * 24 * 7, // 7 дней
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

  if (!state || !savedState || state !== savedState) {
    throw new HTTPException(401, { message: 'Invalid state parameter. CSRF attack detected.' })
  }

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
    maxAge: 60 * 60 * 24 * 7, // 7 дней
  })

  return c.redirect(redirectUrl.toString())
})

export { authController }
