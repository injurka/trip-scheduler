/** Read without importing the auth store (the sync worker also imports the tracker). */
export function trackingOwner(): string | null {
  try {
    const user: unknown = JSON.parse(localStorage.getItem('auth_user') ?? 'null')

    return user && typeof user === 'object' && 'id' in user && typeof user.id === 'string' && user.id ? user.id : null
  }
  catch { return null }
}

export function trackingStorageKey(base: string, owner = trackingOwner()): string {
  return `${base}:v2:${encodeURIComponent(owner ?? 'unassigned')}`
}
