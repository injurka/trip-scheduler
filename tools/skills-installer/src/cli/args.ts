import process from 'node:process'
import { colors } from '../config/colors'

export interface InstallerCliOptions {
  target?: string
  all?: boolean
  skills?: string[]
  includeRules?: boolean
  list?: boolean
  checkPath?: string
  syncSource?: boolean
  syncSourcePath?: string
  force?: boolean
  dryRun?: boolean
  nonInteractive?: boolean
}

export function printHelp(): void {
  console.log(`
${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}
${colors.bright}${colors.cyan}   🤖 Agent Skills Installer & Obsidian Importer Suite${colors.reset}
${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}

${colors.bright}ИСПОЛЬЗОВАНИЕ:${colors.reset}
  bun run skills:install [опции]
  bun run tools/skills-installer/src/run.ts [опции]

${colors.bright}ОПЦИИ:${colors.reset}
  -t, --target <path>       Путь назначения для установки (проект, Obsidian хранилище, глобал)
  -a, --all                 Установить все доступные навыки и правила
  -s, --skills <names>      Список навыков через запятую (напр.: travel-vault-architect,travel-itinerary-enricher)
  --no-rules                Не устанавливать правила (.agents/rules)
  -l, --list                Показать список всех доступных навыков и правил
  -c, --check <path>        Проверить готовность папки тура в Obsidian к работе с obsidian-importer
  --sync-source [path]      Синхронизировать исходные шаблоны навыков из внешнего Obsidian хранилища
  -f, --force               Перезаписывать существующие файлы без подтверждения
  --dry-run                 Тестовый запуск без изменения файлов на диске
  -y, --yes                 Не задавать интерактивных вопросов (принять значения по умолчанию)
  -h, --help                Показать эту справочную информацию

${colors.bright}ПРИМЕРЫ:${colors.reset}
  ${colors.dim}# Интерактивное меню с выбором целевой папки и навыков:${colors.reset}
  bun run skills:install

  ${colors.dim}# Установить все навыки в текущий проект:${colors.reset}
  bun run skills:install --all

  ${colors.dim}# Установить все навыки в хранилище Obsidian (путь нормализуется автоматически):${colors.reset}
  bun run skills:install -t "~/Documents/obsidian-mark/Personal Note/Travel" --all

  ${colors.dim}# Проверить качество разметки тура в Obsidian для obsidian-importer:${colors.reset}
  bun run skills:install --check "~/Documents/obsidian-mark/Personal Note/Travel/-- Taiwan"
`)
}

export function parseCliArgs(): InstallerCliOptions {
  const args = process.argv.slice(2)
  const options: InstallerCliOptions = {
    includeRules: true,
    force: false,
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-h' || arg === '--help') {
      printHelp()
      process.exit(0)
    }
    else if (arg === '-t' || arg === '--target') {
      options.target = args[++i]
    }
    else if (arg === '-a' || arg === '--all') {
      options.all = true
    }
    else if (arg === '-s' || arg === '--skills') {
      const list = args[++i]
      if (list) {
        options.skills = list.split(',').map(s => s.trim()).filter(Boolean)
      }
    }
    else if (arg === '--rules') {
      options.includeRules = true
    }
    else if (arg === '--no-rules') {
      options.includeRules = false
    }
    else if (arg === '-l' || arg === '--list') {
      options.list = true
    }
    else if (arg === '-c' || arg === '--check') {
      options.checkPath = args[++i]
    }
    else if (arg === '--sync-source') {
      options.syncSource = true
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options.syncSourcePath = args[++i]
      }
    }
    else if (arg === '-f' || arg === '--force') {
      options.force = true
    }
    else if (arg === '--dry-run') {
      options.dryRun = true
    }
    else if (arg === '-y' || arg === '--yes') {
      options.nonInteractive = true
    }
  }

  return options
}
