/* eslint-disable no-console */
import type { DumpTarget } from '../src/services/dump.service'
import process from 'node:process'
import prompts from 'prompts'
import { dumpService } from '../src/services/dump.service'

async function runManualDump() {
  try {
    const response = await prompts({
      type: 'select',
      name: 'target',
      message: 'Где вы хотите сохранить дамп?',
      choices: [
        { title: 'Локально и в S3', value: 'both' },
        { title: 'Только локально', value: 'local' },
        { title: 'Только в S3', value: 's3' },
      ],
    })

    if (!response.target) {
      console.log('🚫 Операция отменена.')
      process.exit(0)
    }

    const { baseDir, s3Prefix } = await dumpService.generateAndUploadDump(response.target as DumpTarget)

    console.log(`👋 Дамп завершён.`)
    if (baseDir)
      console.log(`   💾 Локально: ${baseDir}`)
    if (s3Prefix)
      console.log(`   ☁️  S3: ${s3Prefix}/`)

    process.exit(0)
  }
  catch (error) {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  }
}

runManualDump()
