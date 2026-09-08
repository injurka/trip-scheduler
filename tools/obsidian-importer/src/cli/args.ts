import type { CliOptions } from '../types'
import process from 'node:process'
import { colors } from '../config/colors'
import { DEFAULT_AIHUBMIX_MODEL } from '../config/constants'

export function printHelp(): void {
  console.log(`
${colors.bright}${colors.cyan}Obsidian ➔ Trip Scheduler Import Tool (Advanced)${colors.reset}

${colors.bright}ИСПОЛЬЗОВАНИЕ:${colors.reset}
  bun run import:obsidian [опции]
  bun run tools/obsidian-importer/src/run.ts [опции]

${colors.bright}ОПЦИИ:${colors.reset}
  -d, --dir <path>          Путь к папке путешествия в Obsidian Vault
  -u, --api-url <url>       Базовый URL бэкенда (по умолч.: https://trip-scheduler-api.limited-dissolve.ru)
  -e, --email <email>       Email для авторизации (или задайте в .env / server .env)
  -p, --password <pass>     Пароль для авторизации
  -s, --start-date <YYYY-MM-DD> Дата начала путешествия (по умолч.: текущая дата)
  -c, --config <path>       Путь к кастомному файлу конфигурации (по умолч.: importer.config.json)
  --llm                     Использовать LLM для умной генерации активностей
  --no-llm                  Использовать встроенный парсер таймлайна без LLM
  -m, --model <name>        Модель для AIHubMix/OpenAI (по умолч.: из config / ${DEFAULT_AIHUBMIX_MODEL})
  --dry-run                 Режим предпросмотра без отправки запросов в базу
  -v, --validate            Режим валидации хранилища (диагностика структуры, предупреждения, упущенные данные)
  --status <status>         Статус поездки: planned | draft | completed (по умолч.: draft)
  --visibility <vis>        Видимость: private | public (по умолч.: private)
  --trip-id <id>            UUID существующего путешествия для синхронизации/дополнения
  --overwrite-days          Полностью удалить старые дни и активности существующей поездки перед импортом
  --no-images               Не загружать медиа-файлы и фото на сервер
  --no-geo                  Отключить геокодирование адресов в OpenLayers координаты
  -y, --yes                 Не задавать интерактивных вопросов (non-interactive mode)
  -h, --help                Показать эту справку
`)
}

export function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2)
  const options: CliOptions = {
    apiUrl: process.env.API_URL || 'https://trip-scheduler-api.limited-dissolve.ru',
    email: process.env.ADMIN_EMAIL || process.env.USER_EMAIL,
    password: process.env.ADMIN_PASSWORD || process.env.USER_PASSWORD,
    useLlm: true,
    llmModel: undefined,
    dryRun: false,
    visibility: 'private',
    status: 'draft',
    uploadImages: true,
    geocode: true,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-h' || arg === '--help') {
      printHelp()
      process.exit(0)
    }
    else if (arg === '-d' || arg === '--dir') {
      options.dir = args[++i]
    }
    else if (arg === '-u' || arg === '--api-url') {
      options.apiUrl = args[++i]
    }
    else if (arg === '-e' || arg === '--email') {
      options.email = args[++i]
    }
    else if (arg === '-p' || arg === '--password') {
      options.password = args[++i]
    }
    else if (arg === '-s' || arg === '--start-date') {
      options.startDate = args[++i]
    }
    else if (arg === '--llm') {
      options.useLlm = true
    }
    else if (arg === '--no-llm') {
      options.useLlm = false
    }
    else if (arg === '-m' || arg === '--model') {
      options.llmModel = args[++i]
    }
    else if (arg === '--dry-run') {
      options.dryRun = true
    }
    else if (arg === '--status') {
      const s = args[++i] as any
      if (['planned', 'draft', 'completed'].includes(s))
        options.status = s
    }
    else if (arg === '--visibility') {
      const v = args[++i] as any
      if (['private', 'public'].includes(v))
        options.visibility = v
    }
    else if (arg === '--trip-id') {
      options.tripId = args[++i]
    }
    else if (arg === '--overwrite-days') {
      options.daysOverwrite = true
    }
    else if (arg === '--no-images') {
      options.uploadImages = false
    }
    else if (arg === '--no-geo') {
      options.geocode = false
    }
    else if (arg === '-c' || arg === '--config') {
      options.configPath = args[++i]
    }
    else if (arg === '-y' || arg === '--yes') {
      options.nonInteractive = true
    }
    else if (arg === '-v' || arg === '--validate') {
      options.validate = true
    }
  }

  return options
}
