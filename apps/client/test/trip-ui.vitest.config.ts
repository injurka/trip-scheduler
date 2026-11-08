import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'happy-dom', include: ['test/trip-ui.spec.ts'], maxWorkers: 1 },
})
