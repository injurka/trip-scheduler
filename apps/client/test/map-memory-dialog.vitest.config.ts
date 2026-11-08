import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('../src/renderer', import.meta.url)) } },
  test: { environment: 'happy-dom', include: ['test/map-memory-dialog.spec.ts', 'test/memory-export.spec.ts', 'test/track-stop-map.spec.ts'], maxWorkers: 1 },
})
