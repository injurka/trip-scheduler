import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'happy-dom', include: ['test/dialog-navigation.spec.ts'], maxWorkers: 1 },
})
