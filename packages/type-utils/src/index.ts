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

export function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error))
    return undefined
  const direct = error.status ?? error.statusCode
  if (typeof direct === 'number')
    return direct
  if (isRecord(error.response) && typeof error.response.status === 'number')
    return error.response.status
  if (isRecord(error.data) && typeof error.data.httpStatus === 'number')
    return error.data.httpStatus
  if (isRecord(error.shape) && isRecord(error.shape.data) && typeof error.shape.data.httpStatus === 'number')
    return error.shape.data.httpStatus
  return undefined
}
