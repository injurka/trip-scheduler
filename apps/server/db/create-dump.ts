import process from 'node:process'
import { dumpService } from '../src/services/dump.service'

async function runManualDump() {
  try {
    await dumpService.generateAndUploadDump()
    // eslint-disable-next-line no-console
    console.log('👋 Завершение работы скрипта.')
    process.exit(0)
  }
  catch (error) {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  }
}

runManualDump()
