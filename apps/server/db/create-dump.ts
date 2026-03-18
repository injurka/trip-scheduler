import process from 'node:process'
import { dumpService } from '../src/services/dump.service'

async function runManualDump() {
  try {
    const prefix = await dumpService.generateAndUploadDump()
    // eslint-disable-next-line no-console
    console.log(`👋 Дамп завершён. S3-путь: ${prefix}/`)
    process.exit(0)
  }
  catch (error) {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  }
}

runManualDump()
