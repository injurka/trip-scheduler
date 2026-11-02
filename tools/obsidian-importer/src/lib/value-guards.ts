/** A JSON value whose shape must be checked before use. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error)
    return error.message
  if (typeof error === 'string')
    return error
  if (isRecord(error) && typeof error.message === 'string')
    return error.message
  return fallback
}

export function getErrorCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === 'string' ? error.code : undefined
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(getErrorMessage(error))
}
