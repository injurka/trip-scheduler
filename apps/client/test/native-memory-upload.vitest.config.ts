import { defineConfig } from 'vitest/config'
import base from './memory-export.vitest.config.ts'

export default defineConfig({ ...base, test: { ...base.test, include: ['test/native-memory-upload.spec.ts'] } })
