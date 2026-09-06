#!/usr/bin/env bun
import process from 'node:process'
import { runImport } from './cli/importer'

runImport().catch((err) => {
  console.error('\n❌ Непредвиденная ошибка при импорте:', err)
  process.exit(1)
})
