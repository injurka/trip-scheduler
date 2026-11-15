import { defineConfig } from 'vitest/config'
import base from './upload-manager.vitest.config.ts'

export default defineConfig({
  ...base,
  test: { ...base.test, include: ['test/offline-status.spec.ts'] },
})
