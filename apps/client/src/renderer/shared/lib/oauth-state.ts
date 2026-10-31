const PENDING_OAUTH_STATE_KEY = 'pending_oauth_state'
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

interface StoredOAuthState {
  value: string
  expiresAt: number
}

export function createOAuthClientState(): string {
  const value = crypto.randomUUID()
  const storedState: StoredOAuthState = {
    value,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  }

  localStorage.setItem(PENDING_OAUTH_STATE_KEY, JSON.stringify(storedState))

  return value
}

export function verifyOAuthClientState(value: string | null): boolean {
  const storedValue = localStorage.getItem(PENDING_OAUTH_STATE_KEY)

  if (!storedValue)
    return value === null

  localStorage.removeItem(PENDING_OAUTH_STATE_KEY)

  try {
    const storedState = JSON.parse(storedValue) as Partial<StoredOAuthState>

    return typeof storedState.value === 'string'
      && typeof storedState.expiresAt === 'number'
      && storedState.expiresAt >= Date.now()
      && storedState.value === value
  }
  catch {
    return false
  }
}
