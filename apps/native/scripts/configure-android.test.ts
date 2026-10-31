import { describe, expect, test } from 'bun:test'
import { addFirebaseGradlePlugin, configureAndroidKotlin } from './configure-android'

const ROOT_BUILD = `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.11.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
`

describe('Android Kotlin compatibility', () => {
  test('upgrades the compiler inherited by app and library modules from the Tauri root', () => {
    const configured = configureAndroidKotlin(ROOT_BUILD)
    expect(configured).toContain('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.21")')
    expect(configured).not.toContain('1.9.25')
    expect(configured).toContain('classpath("com.android.tools.build:gradle:8.11.0")')
    expect(configureAndroidKotlin(configured)).toBe(configured)
    expect(addFirebaseGradlePlugin(configured, '4.5.0')).toContain('classpath("com.google.gms:google-services:4.5.0")')
  })

  test('supports the plugins DSL and Kotlin shorthand', () => {
    expect(configureAndroidKotlin('plugins { id("org.jetbrains.kotlin.android") version "1.9.25" apply false }'))
      .toContain('version "2.2.21" apply false')
    expect(configureAndroidKotlin('plugins { kotlin("android") version "2.1.21" apply false }'))
      .toContain('version "2.2.21" apply false')
  })

  test('keeps a newer compiler rather than downgrading a newer Tauri template', () => {
    const newer = ROOT_BUILD.replace('1.9.25', '2.3.0')
    expect(configureAndroidKotlin(newer)).toBe(newer)
  })

  test('replaces a version variable in a buildscript coordinate', () => {
    const variable = ROOT_BUILD.replace('1.9.25', '$kotlinVersion')
    expect(configureAndroidKotlin(variable)).toContain('kotlin-gradle-plugin:2.2.21')
  })

  test('fails explicitly if the generated template stops declaring a Kotlin version', () => {
    expect(() => configureAndroidKotlin('allprojects {}')).toThrow('Kotlin Gradle plugin version')
  })
})

describe('Firebase Gradle configuration', () => {
  test('adds the Google Services classpath to the generated Tauri root buildscript', () => {
    const configured = addFirebaseGradlePlugin(ROOT_BUILD, '4.5.0')
    expect(configured).toContain('dependencies {\n        classpath("com.google.gms:google-services:4.5.0")')
    expect(configured).toContain('classpath("com.android.tools.build:gradle:8.11.0")')
    expect(configured).not.toContain('plugins {')
    expect(addFirebaseGradlePlugin(configured, '4.5.0')).toBe(configured)
  })

  test('updates an existing buildscript classpath without duplicating it', () => {
    const configured = addFirebaseGradlePlugin(ROOT_BUILD, '4.4.4')
    const updated = addFirebaseGradlePlugin(configured, '4.5.0')
    expect(updated.match(/com\.google\.gms:google-services:/g)).toHaveLength(1)
    expect(updated).toContain('google-services:4.5.0')
    expect(updated).not.toContain('4.4.4')
  })

  test('also supports a root project using the plugins DSL', () => {
    const configured = addFirebaseGradlePlugin('plugins {\n    id("com.android.application") version "8.11.0" apply false\n}\n', '4.4.4')
    const updated = addFirebaseGradlePlugin(configured, '4.5.0')
    expect(updated).toContain('id("com.google.gms.google-services") version "4.5.0" apply false')
    expect(updated.match(/com\.google\.gms\.google-services/g)).toHaveLength(1)
  })

  test('applies the plugin once in the app module without declaring its version again', () => {
    const configured = addFirebaseGradlePlugin('plugins {\n    id("com.android.application")\n    id("org.jetbrains.kotlin.android")\n}\n')
    expect(configured).toContain('id("com.google.gms.google-services")')
    expect(configured).not.toContain('version')
    expect(configured).not.toContain('apply false')
    expect(addFirebaseGradlePlugin(configured)).toBe(configured)
  })

  test('supports an app module using apply syntax', () => {
    const configured = addFirebaseGradlePlugin('apply(plugin = "com.android.application")\n')
    expect(configured).toContain('apply(plugin = "com.google.gms.google-services")')
    expect(addFirebaseGradlePlugin(configured)).toBe(configured)
  })

  test('identifies the unsupported Gradle file in the error', () => {
    expect(() => addFirebaseGradlePlugin('allprojects {}', '4.5.0')).toThrow('root Android Gradle file')
    expect(() => addFirebaseGradlePlugin('android {}')).toThrow('app Android Gradle file')
  })
})
