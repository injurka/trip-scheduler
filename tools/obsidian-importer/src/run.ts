#!/usr/bin/env bun
import process from 'node:process'
import { ImportErrorsError, runImport } from './cli/importer'

runImport().catch((err) => {
  if (err instanceof ImportErrorsError) {
    console.error(`❌ ${err.message}`)
    process.exit(1)
  }
  console.error('\n❌ Непредвиденная ошибка при импорте:', err)
  process.exit(1)
})
