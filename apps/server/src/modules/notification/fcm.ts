interface FcmServiceAccount {
  project_id: string
  client_email: string
  private_key: string
  token_uri?: string
}

interface CachedAccessToken {
  accessToken: string
  expiresAt: number
}

interface FcmErrorResponse {
  error?: {
    status?: string
    message?: string
    details?: Array<{ errorCode?: string, reason?: string }>
  }
}

export class FcmRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'FcmRequestError'
  }
}

let serviceAccount: FcmServiceAccount | undefined
let cachedAccessToken: CachedAccessToken | undefined
let accessTokenRequest: Promise<CachedAccessToken> | undefined

const OAUTH_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token'
const ACCESS_TOKEN_LIFETIME_SECONDS = 3600

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodePrivateKey(pem: string): Uint8Array<ArrayBuffer> {
  const base64 = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')

  const decoded = atob(base64)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index++)
    bytes[index] = decoded.charCodeAt(index)

  return bytes
}

function getServiceAccount(): FcmServiceAccount {
  if (serviceAccount)
    return serviceAccount

  let parsed: Partial<FcmServiceAccount>
  try {
    const encodedJson = process.env.FCM_SERVICE_ACCOUNT_JSON_BASE64?.trim()
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim() || (encodedJson ? atob(encodedJson) : '')
    parsed = JSON.parse(raw) as Partial<FcmServiceAccount>
    if (!parsed || !parsed.project_id || !parsed.client_email || !parsed.private_key)
      throw new Error('Missing service account fields')
  }
  catch {
    // JSON parser errors can include credential contents. Never forward them.
    throw new FcmRequestError('INVALID_CREDENTIALS', 'FCM service account configuration is missing or invalid')
  }

  serviceAccount = parsed as FcmServiceAccount
  return serviceAccount
}

export function hasFcmServiceAccountConfigured(): boolean {
  return Boolean(process.env.FCM_SERVICE_ACCOUNT_JSON || process.env.FCM_SERVICE_ACCOUNT_JSON_BASE64)
}

async function createAccessToken(): Promise<CachedAccessToken> {
  const account = getServiceAccount()
  const tokenUri = account.token_uri || DEFAULT_TOKEN_URI
  const now = Math.floor(Date.now() / 1000)
  const jwtHeader = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const jwtClaims = base64UrlEncode(JSON.stringify({
    iss: account.client_email,
    scope: OAUTH_SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + ACCESS_TOKEN_LIFETIME_SECONDS,
  }))
  const unsignedAssertion = `${jwtHeader}.${jwtClaims}`
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    decodePrivateKey(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  ).catch(() => {
    throw new FcmRequestError('INVALID_CREDENTIALS', 'FCM service account private key is invalid')
  })
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    signingKey,
    new TextEncoder().encode(unsignedAssertion),
  )
  const assertion = `${unsignedAssertion}.${base64UrlEncode(new Uint8Array(signature))}`
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const responseBody = await response.json().catch(() => null) as {
    access_token?: string
    expires_in?: number
    error_description?: string
  } | null

  if (!response.ok || !responseBody?.access_token) {
    throw new FcmRequestError(`OAUTH_${response.status}`, `FCM OAuth token request failed (${response.status})`)
  }

  return {
    accessToken: responseBody.access_token,
    expiresAt: Date.now() + (responseBody.expires_in ?? ACCESS_TOKEN_LIFETIME_SECONDS) * 1000,
  }
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (forceRefresh)
    cachedAccessToken = undefined

  if (cachedAccessToken && cachedAccessToken.expiresAt - Date.now() > 60_000)
    return cachedAccessToken.accessToken

  if (!accessTokenRequest) {
    accessTokenRequest = createAccessToken()
      .then((token) => {
        cachedAccessToken = token
        return token
      })
      .finally(() => {
        accessTokenRequest = undefined
      })
  }

  return (await accessTokenRequest).accessToken
}

export async function sendFcmMessage(token: string, data: Record<string, string>) {
  const account = getServiceAccount()
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`

  const send = async (accessToken: string) => await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        data,
        android: {
          priority: 'HIGH',
          ttl: '86400s',
        },
      },
    }),
  })

  let response = await send(await getAccessToken())
  if (response.status === 401)
    response = await send(await getAccessToken(true))

  const responseBody = await response.json().catch(() => null) as FcmErrorResponse | null
  const errorCode = responseBody?.error?.details?.find(detail => detail.errorCode)?.errorCode
    ?? responseBody?.error?.details?.find(detail => detail.reason)?.reason
    ?? responseBody?.error?.status

  return {
    ok: response.ok,
    status: response.status,
    errorCode,
    errorMessage: responseBody?.error?.message,
  }
}
