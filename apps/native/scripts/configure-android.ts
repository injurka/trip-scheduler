import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MANIFEST_PATH = resolve(
  import.meta.dirname,
  '../src-tauri/gen/android/app/src/main/AndroidManifest.xml',
)

const REQUIRED_PERMISSIONS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  'android.permission.REQUEST_INSTALL_PACKAGES',
]

export function configureAndroidManifest(): boolean {
  if (!existsSync(MANIFEST_PATH)) {
    console.log('[configure-android] AndroidManifest.xml not found yet, skipping.')
    return false
  }

  let content = readFileSync(MANIFEST_PATH, 'utf-8')
  let modified = false

  // 1. Add permissions inside <manifest> if missing
  for (const perm of REQUIRED_PERMISSIONS) {
    const tag = `<uses-permission android:name="${perm}" />`
    if (!content.includes(perm)) {
      content = content.replace('</manifest>', `    ${tag}\n</manifest>`)
      console.log(`[configure-android] Added permission: ${perm}`)
      modified = true
    }
  }

  // 2. Add GPS hardware feature if missing
  const gpsFeature = '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'
  if (!content.includes('android.hardware.location.gps')) {
    content = content.replace('</manifest>', `    ${gpsFeature}\n</manifest>`)
    console.log('[configure-android] Added GPS hardware feature')
    modified = true
  }

  // 3. Add Deep Link intent-filter for scheme "trip-scheduler" inside MainActivity
  const deepLinkFilter = `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="trip-scheduler" />
            </intent-filter>`

  if (!content.includes('android:scheme="trip-scheduler"')) {
    if (content.includes('</activity>')) {
      content = content.replace('</activity>', `${deepLinkFilter}\n        </activity>`)
      console.log('[configure-android] Added deep-link intent-filter (trip-scheduler://)')
      modified = true
    }
  }

  if (modified) {
    writeFileSync(MANIFEST_PATH, content, 'utf-8')
    console.log('[configure-android] Successfully updated AndroidManifest.xml')
  }
  else {
    console.log('[configure-android] AndroidManifest.xml is already up to date.')
  }

  return true
}

if (import.meta.main) {
  configureAndroidManifest()
}

