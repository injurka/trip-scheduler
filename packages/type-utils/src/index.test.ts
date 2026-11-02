import { describe, expect, it } from 'bun:test'
import { getErrorCode, getErrorMessage, getErrorStatus, isRecord, toError } from './index'

describe('unknown value boundaries', () => {
  it('accepts records and rejects arrays and null', () => {
    expect(isRecord({ value: 1 })).toBe(true)
    for (const value of [null, undefined, [], 'text', 123])
      expect(isRecord(value)).toBe(false)
  })
  it('preserves real errors and safely handles other thrown values', () => {
    const error = new Error('failed')
    expect(toError(error)).toBe(error)
    expect(getErrorMessage({ message: 'API failed' })).toBe('API failed')
    expect(getErrorMessage(null, 'fallback')).toBe('fallback')
    expect(getErrorCode({ code: 404 })).toBeUndefined()
    expect(getErrorCode({ code: 'NOT_FOUND' })).toBe('NOT_FOUND')
  })
  it('reads HTTP and tRPC status without trusting malformed values', () => {
    expect(getErrorStatus({ response: { status: 401 } })).toBe(401)
    expect(getErrorStatus({ shape: { data: { httpStatus: 403 } } })).toBe(403)
    expect(getErrorStatus({ status: '401' })).toBeUndefined()
    const cyclic: { shape?: unknown } = {}
    cyclic.shape = cyclic
    expect(getErrorStatus(cyclic)).toBeUndefined()
  })
})
