import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
const ANDROID_APP_GRADLE_PATH = resolve(
  import.meta.dirname,
  '../src-tauri/gen/android/app/build.gradle.kts',
)
const FIREBASE_CONFIG_SOURCE = process.env.FIREBASE_ANDROID_CONFIG_PATH
  ? resolve(process.env.FIREBASE_ANDROID_CONFIG_PATH)
  : resolve(import.meta.dirname, '../firebase/google-services.json')
const FIREBASE_CONFIG_DESTINATION = resolve(
  import.meta.dirname,
  '../src-tauri/gen/android/app/google-services.json',
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

  // Tauri owns the app FileProvider. Extend its resource instead of declaring
  // a second provider in the tracking plugin (Android merges providers by
  // android:name and rejects conflicting FILE_PROVIDER_PATHS metadata).
  if (existsSync(FILE_PATHS_PATH)) {
    let filePaths = readFileSync(FILE_PATHS_PATH, 'utf-8')
    let pathsModified = false
    if (!filePaths.includes('name="updates"')) {
      filePaths = filePaths.replace(
        '</paths>',
        '    <cache-path name="updates" path="updates/" />\n</paths>',
      )
      pathsModified = true
      console.log('[configure-android] Added APK update path to FileProvider paths')
    }
    if (!filePaths.includes('name="exports"')) {
      filePaths = filePaths.replace(
        '</paths>',
        '    <cache-path name="exports" path="exports/" />\n</paths>',
      )
      pathsModified = true
      console.log('[configure-android] Added KMZ exports path to FileProvider paths')
    }
    if (pathsModified) {
      writeFileSync(FILE_PATHS_PATH, filePaths, 'utf-8')
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

  // 5. Add queries for Maps.me / Organic Maps / geo files
  const queriesTag = `    <queries>
        <package android:name="com.mapswithme.maps.pro" />
        <package android:name="app.organicmaps" />
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:mimeType="application/vnd.google-earth.kmz" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:mimeType="application/vnd.google-earth.kml+xml" />
        </intent>
    </queries>`

  if (!content.includes('android:name="com.mapswithme.maps.pro"')) {
    if (content.includes('</manifest>')) {
      content = content.replace('</manifest>', `${queriesTag}\n</manifest>`)
      console.log('[configure-android] Added queries for Maps.me / Organic Maps')
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

export function configureAndroidKotlin(content: string): string {
  const minimumVersion = '2.2.21'
  const declarations = [
    /(classpath\(\s*["']org\.jetbrains\.kotlin:kotlin-gradle-plugin:)([^"']+)(["']\s*\))/g,
    /(id\(["']org\.jetbrains\.kotlin\.android["']\)\s+version\s+["'])([^"']+)(["'])/g,
    /(kotlin\(["']android["']\)\s+version\s+["'])([^"']+)(["'])/g,
  ]

  for (const declaration of declarations) {
    if (!declaration.test(content))
      continue

    declaration.lastIndex = 0
    return content.replace(declaration, (_, prefix: string, version: string, suffix: string) => {
      const parts = version.split('.').map(Number)
      const minimum = minimumVersion.split('.').map(Number)
      for (let index = 0; index < minimum.length; index++) {
        if (Number.isNaN(parts[index]) || parts[index] < minimum[index])
          return `${prefix}${minimumVersion}${suffix}`
        if (parts[index] > minimum[index])
          return `${prefix}${version}${suffix}`
      }
      return `${prefix}${version}${suffix}`
    })
  }

  throw new Error('[configure-android] Cannot find the Kotlin Gradle plugin version in the generated root Android Gradle file.')
}

export function addFirebaseGradlePlugin(content: string, version?: string): string {
  if (version) {
    const classpath = /(classpath\(["']com\.google\.gms:google-services:)[^"']+(["']\))/
    if (classpath.test(content))
      return content.replace(classpath, `$1${version}$2`)

    const declaration = /(id\(["']com\.google\.gms\.google-services["']\)\s+version\s+["'])[^"']+(["']\s+apply false)/
    if (declaration.test(content))
      return content.replace(declaration, `$1${version}$2`)

    // Tauri's root project declares plugin dependencies through buildscript,
    // while its app module applies them through the plugins DSL.
    const buildscriptDependencies = /\bbuildscript\s*\{[\s\S]*?\bdependencies\s*\{/.exec(content)
    if (buildscriptDependencies) {
      const insertionPoint = buildscriptDependencies.index + buildscriptDependencies[0].length
      return `${content.slice(0, insertionPoint)}\n        classpath("com.google.gms:google-services:${version}")${content.slice(insertionPoint)}`
    }
  }

  if (content.includes('com.google.gms.google-services'))
    return content

  const pluginsBlock = /plugins\s*\{/.exec(content)
  if (!pluginsBlock) {
    if (!version) {
      const applyPlugin = /^[ \t]*apply\(plugin\s*=\s*["'][^"']+["']\)[ \t]*$/m
      if (applyPlugin.test(content))
        return content.replace(applyPlugin, '$&\napply(plugin = "com.google.gms.google-services")')
    }
    throw new Error(`[configure-android] Cannot find ${version ? 'buildscript dependencies or plugins' : 'plugins or apply(plugin = ...)'} in generated ${version ? 'root' : 'app'} Android Gradle file.`)
  }

  const insertionPoint = pluginsBlock.index + pluginsBlock[0].length
  const declaration = version
    ? `\n    id("com.google.gms.google-services") version "${version}" apply false`
    : '\n    id("com.google.gms.google-services")'
  return content.slice(0, insertionPoint) + declaration + content.slice(insertionPoint)
}

export function configureAndroidFirebase(): boolean {
  if (!existsSync(ANDROID_BUILD_GRADLE_PATH) || !existsSync(ANDROID_APP_GRADLE_PATH)) {
    console.log('[configure-android] Generated Android Gradle project not found yet; run `tauri android init` first.')
    return false
  }

  if (!existsSync(FIREBASE_CONFIG_SOURCE)) {
    throw new Error(
      `[configure-android] Firebase Android config is missing at ${FIREBASE_CONFIG_SOURCE}. `
      + 'Download google-services.json for package ru.tripscheduler.app and put it there, '
      + 'or set FIREBASE_ANDROID_CONFIG_PATH.',
    )
  }

  const firebaseConfig = JSON.parse(readFileSync(FIREBASE_CONFIG_SOURCE, 'utf-8')) as {
    client?: Array<{ client_info?: { android_client_info?: { package_name?: string } } }>
  }
  const hasMatchingPackage = firebaseConfig.client?.some(
    client => client.client_info?.android_client_info?.package_name === 'ru.tripscheduler.app',
  )
  if (!hasMatchingPackage)
    throw new Error('[configure-android] google-services.json does not contain package ru.tripscheduler.app.')

  const rootBuild = addFirebaseGradlePlugin(
    configureAndroidKotlin(readFileSync(ANDROID_BUILD_GRADLE_PATH, 'utf-8')),
    '4.5.0',
  )
  const appBuild = addFirebaseGradlePlugin(readFileSync(ANDROID_APP_GRADLE_PATH, 'utf-8'))
  writeFileSync(ANDROID_BUILD_GRADLE_PATH, rootBuild, 'utf-8')
  writeFileSync(ANDROID_APP_GRADLE_PATH, appBuild, 'utf-8')

  mkdirSync(resolve(import.meta.dirname, '../src-tauri/gen/android/app'), { recursive: true })
  copyFileSync(FIREBASE_CONFIG_SOURCE, FIREBASE_CONFIG_DESTINATION)
  console.log('[configure-android] Configured Firebase Cloud Messaging for the Android app.')
  return true
}

if (import.meta.main) {
  configureAndroidManifest()
  configureAndroidFirebase()
}
