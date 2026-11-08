import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'happy-dom', include: ['test/connectivity.spec.ts'], maxWorkers: 1 },
})
