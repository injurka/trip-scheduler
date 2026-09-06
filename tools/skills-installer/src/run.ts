#!/usr/bin/env bun
import process from 'node:process'
import { runInstaller } from './cli/installer'

runInstaller().catch((err) => {
  console.error('\n❌ Непредвиденная ошибка при установке навыков:', err)
  process.exit(1)
})
