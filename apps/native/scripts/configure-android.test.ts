import { describe, expect, test } from 'bun:test'
import { addFirebaseGradlePlugin } from './configure-android'

const ROOT_BUILD = `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.11.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.0")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
`

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
