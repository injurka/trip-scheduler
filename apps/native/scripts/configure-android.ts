import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MANIFEST_PATH = resolve(
  import.meta.dirname,
  '../src-tauri/gen/android/app/src/main/AndroidManifest.xml',
)
const FILE_PATHS_PATH = resolve(
  import.meta.dirname,
  '../src-tauri/gen/android/app/src/main/res/xml/file_paths.xml',
)
const ANDROID_BUILD_GRADLE_PATH = resolve(
  import.meta.dirname,
  '../src-tauri/gen/android/build.gradle.kts',
)
const RUSTORE_MAVEN_REPOSITORY = 'https://nexus-external.rustore.ru/repository/maven-rustore-exposed/'

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

  // Tauri owns the app FileProvider. Extend its resource instead of declaring
  // a second provider in the tracking plugin (Android merges providers by
  // android:name and rejects conflicting FILE_PROVIDER_PATHS metadata).
  if (existsSync(FILE_PATHS_PATH)) {
    let filePaths = readFileSync(FILE_PATHS_PATH, 'utf-8')
    if (!filePaths.includes('name="updates"')) {
      filePaths = filePaths.replace(
        '</paths>',
        '    <cache-path name="updates" path="updates/" />\n</paths>',
      )
      writeFileSync(FILE_PATHS_PATH, filePaths, 'utf-8')
      console.log('[configure-android] Added APK update path to FileProvider paths')
    }
  }

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

  // 3.1. Add App Links intent-filter for domain "trip-scheduler.limited-dissolve.ru"
  const appLinkFilter = `            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="trip-scheduler.limited-dissolve.ru" />
                <data android:scheme="http" android:host="trip-scheduler.limited-dissolve.ru" />
            </intent-filter>`

  if (!content.includes('android:host="trip-scheduler.limited-dissolve.ru"')) {
    if (content.includes('</activity>')) {
      content = content.replace('</activity>', `${appLinkFilter}\n        </activity>`)
      console.log('[configure-android] Added App Links intent-filter (trip-scheduler.limited-dissolve.ru)')
      modified = true
    }
  }

  // 4. Add Tracking Foreground Service inside <application> if missing
  const serviceTag = `        <service
            android:name="ru.tripscheduler.tracking.TrackingService"
            android:foregroundServiceType="location"
            android:exported="false" />`

  if (!content.includes('ru.tripscheduler.tracking.TrackingService')) {
    if (content.includes('</application>')) {
      content = content.replace('</application>', `${serviceTag}\n    </application>`)
      console.log('[configure-android] Added TrackingService with foregroundServiceType="location"')
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

export function configureAndroidRepositories(): boolean {
  if (!existsSync(ANDROID_BUILD_GRADLE_PATH)) {
    console.log('[configure-android] Android root build.gradle.kts not found yet, skipping.')
    return false
  }

  const content = readFileSync(ANDROID_BUILD_GRADLE_PATH, 'utf-8')
  if (content.includes(RUSTORE_MAVEN_REPOSITORY)) {
    console.log('[configure-android] RuStore Maven repository is already configured.')
    return true
  }

  // Tauri's Android root project owns dependency repositories. The tracking
  // plugin's settings.gradle is only used when the plugin is built separately.
  const repositories = /allprojects\s*\{[\s\S]*?repositories\s*\{[\s\S]*?^([ \t]*)mavenCentral\(\)[ \t]*(\r?\n)/m.exec(content)
  if (!repositories) {
    throw new Error('[configure-android] Cannot find allprojects repositories in Android root build.gradle.kts.')
  }

  const insertionPoint = repositories.index + repositories[0].length
  const repositoryLine = `${repositories[1]}maven { url = uri("${RUSTORE_MAVEN_REPOSITORY}") }${repositories[2]}`
  writeFileSync(ANDROID_BUILD_GRADLE_PATH, content.slice(0, insertionPoint) + repositoryLine + content.slice(insertionPoint), 'utf-8')
  console.log('[configure-android] Added RuStore Maven repository to Android root build.gradle.kts')
  return true
}

if (import.meta.main) {
  configureAndroidManifest()
  configureAndroidRepositories()
}
