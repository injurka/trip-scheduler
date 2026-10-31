import { describe, expect, test } from 'bun:test'
import config from '../src-tauri/tauri.conf.json'

describe('native deep link configuration', () => {
  test('registers OAuth and sharing custom links with the Android plugin, not only the OS', () => {
    // Android DeepLinkPlugin rejects every intent when config.mobile is empty,
    // even if configure-android.ts added an intent-filter to the manifest.
    const customScheme = config.plugins['deep-link'].mobile.find(domain => domain.scheme.includes('trip-scheduler'))
    expect(customScheme).toBeDefined()
    expect(customScheme?.appLink).toBe(false)
    // auth/callback, user/settings and trip/... use different URI hosts.
    expect(customScheme?.host).toBeUndefined()
    expect(customScheme).not.toHaveProperty('path')
    expect(customScheme).not.toHaveProperty('pathPrefix')
  })

  test('also delivers existing public app links to the frontend', () => {
    const webLinks = config.plugins['deep-link'].mobile.find(domain => domain.host === 'trip-scheduler.limited-dissolve.ru')
    expect(webLinks?.scheme).toContain('https')
    expect(webLinks?.scheme).toContain('http')
  })
})
