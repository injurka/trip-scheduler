import { execSync } from 'node:child_process'
import process from 'node:process'
import { visualizer } from 'rollup-plugin-visualizer'

function visualizerPlugin(type: 'renderer' | 'main') {
  return process.env[`VISUALIZER_${type.toUpperCase()}`] ? [visualizer({ open: true })] : []
}

function resolveAppVersion(fallbackVersion: string): string {
  if (process.env.VITE_APP_VERSION)
    return process.env.VITE_APP_VERSION.replace(/^v/, '')

  try {
    return execSync('git describe --tags --abbrev=0', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .replace(/^v/, '')
  }
  catch {
    return fallbackVersion
  }
}

export { resolveAppVersion, visualizerPlugin }
