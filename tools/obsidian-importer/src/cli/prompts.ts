import type { CliOptions, ParsedTripData } from '../types'
import { basename } from 'node:path'
import process from 'node:process'
import prompts from 'prompts'
import { colors } from '../config/colors'
import { AIHUBMIX_MODELS, DEFAULT_AIHUBMIX_MODEL } from '../config/constants'
import { discoverObsidianTravelFolders, normalizeVaultPath } from '../parsers/vault'

export async function promptForTargetDirectory(initialDir?: string): Promise<string> {
  let targetDir = initialDir

  if (!targetDir) {
    const discovered = discoverObsidianTravelFolders()

    if (discovered.length > 0) {
      const choices = discovered.map(p => ({
        title: basename(p).replace(/^--\s*/, ''),
        description: p,
        value: p,
      }))
      choices.push({ title: '📁 Ввести путь вручную...', description: 'Указать абсолютный путь', value: 'custom' })

      const resp = await prompts({
        type: 'select',
        name: 'folder',
        message: 'Выберите папку путешествия из найденных в Obsidian Vault:',
        choices,
      })

      if (resp.folder === 'custom') {
        const customResp = await prompts({
          type: 'text',
          name: 'folder',
          message: 'Введите полный путь к папке путешествия:',
        })
        targetDir = customResp.folder
      }
      else {
        targetDir = resp.folder
      }
    }
    else {
      const resp = await prompts({
        type: 'text',
        name: 'folder',
        message: 'Введите полный путь к папке путешествия в Obsidian:',
      })
      targetDir = resp.folder
    }
  }

  if (!targetDir) {
    console.error(`${colors.red}❌ Не указана папка путешествия.${colors.reset}`)
    process.exit(1)
  }

  return normalizeVaultPath(targetDir)
}

export async function promptForInteractiveOptions(
  cliOptions: CliOptions,
  tripData: ParsedTripData,
): Promise<{
  importTripMeta: boolean
  importDays: boolean
  importActivities: boolean
  importChecklists: boolean
  importNotes: boolean
  importSections: boolean
  useLlm: boolean
  selectedModel: string
  confirmed: boolean
}> {
  let importTripMeta = cliOptions.importTripMeta ?? true
  let importDays = cliOptions.importDays ?? true
  let importActivities = cliOptions.importActivities ?? true
  let importChecklists = cliOptions.importChecklists ?? true
  let importNotes = cliOptions.importNotes ?? true
  let importSections = cliOptions.importSections ?? true
  let useLlm = cliOptions.useLlm
  let selectedModel = cliOptions.llmModel || DEFAULT_AIHUBMIX_MODEL

  if (!cliOptions.nonInteractive) {
    const choices = [
      { title: `🚀 Основные данные путешествия («${tripData.title}»)`, value: 'meta', selected: true },
      { title: `📅 Дни маршрута (${tripData.days.length} дн. с инфо-блоками day.meta)`, value: 'days', selected: true },
      { title: `🧩 Блоки активностей (расписание с таймлайном, локациями и галереями)`, value: 'activities', selected: true },
      { title: `📋 Чек-листы и списки сборов (${tripData.checklistContent.items?.length || 0} задач)`, value: 'checklists', selected: true },
      { title: `📝 Заметки и статьи (${tripData.sectionFolders.length} папок, ${tripData.rootNotes.length} корн. файлов)`, value: 'notes', selected: true },
      { title: `📑 Разделы-вкладки (Бронирования, Финансы, Чек-листы, Заметки, Воспоминания, Документы)`, value: 'sections', selected: true },
    ]

    const modulesResp = await prompts({
      type: 'multiselect',
      name: 'modules',
      message: 'Выберите модули для импорта в Trip Scheduler:',
      choices,
      hint: '- Пробел для выбора/снятия, Enter для подтверждения',
      instructions: false,
    })

    if (!modulesResp.modules) {
      console.log(`${colors.yellow}Импорт отменен.${colors.reset}`)
      process.exit(0)
    }

    const selectedMods = modulesResp.modules as string[]
    importTripMeta = selectedMods.includes('meta')
    importDays = selectedMods.includes('days')
    importActivities = selectedMods.includes('activities')
    importChecklists = selectedMods.includes('checklists')
    importNotes = selectedMods.includes('notes')
    importSections = selectedMods.includes('sections')

    if (importActivities) {
      const modeResp = await prompts({
        type: 'select',
        name: 'mode',
        message: 'Как генерировать блоки активностей внутри каждого дня?',
        choices: [
          {
            title: '🤖 Умный LLM (AIHubMix / OpenAI / Сервер) — извлекает теги и детали расписания',
            description: 'Использует AI_HUBMIX_KEY / OPENAI_API_KEY или встроенный эндпоинт сервера',
            value: 'llm',
          },
          {
            title: '⚙️  Встроенный парсер таймлайна — мгновенно извлекает активности вида **10:00 - 12:00**',
            description: 'Без обращения к LLM (100% офлайн, парсинг markdown)',
            value: 'parser',
          },
        ],
        initial: 0,
      })

      useLlm = modeResp.mode === 'llm'

      if (useLlm && !cliOptions.llmModel) {
        const modelResp = await prompts({
          type: 'select',
          name: 'model',
          message: 'Выберите модель AIHubMix / OpenAI для обработки:',
          choices: AIHUBMIX_MODELS.map(m => ({ title: m.title, value: m.value })),
          initial: 0,
        })

        if (modelResp.model === 'custom') {
          const customModelResp = await prompts({
            type: 'text',
            name: 'customModel',
            message: 'Введите идентификатор модели (например, gpt-4o, claude-3-7-sonnet-20250219, deepseek-ai/DeepSeek-V3):',
            initial: DEFAULT_AIHUBMIX_MODEL,
          })
          selectedModel = customModelResp.customModel?.trim() || DEFAULT_AIHUBMIX_MODEL
        }
        else if (modelResp.model) {
          selectedModel = modelResp.model
        }
      }
    }

    if (!cliOptions.dryRun) {
      const confirmResp = await prompts({
        type: 'confirm',
        name: 'value',
        message: 'Начать создание и загрузку в Trip Scheduler?',
        initial: true,
      })

      if (!confirmResp.value) {
        console.log(`${colors.yellow}Импорт отменен пользователем.${colors.reset}`)
        process.exit(0)
      }
    }
  }

  return {
    importTripMeta,
    importDays,
    importActivities,
    importChecklists,
    importNotes,
    importSections,
    useLlm,
    selectedModel,
    confirmed: true,
  }
}

export async function promptForCredentials(options: CliOptions): Promise<{ email: string, password: string }> {
  let email = options.email
  let password = options.password

  if (!email || !password) {
    console.log(`\n${colors.bright}🔐 Авторизация в Trip Scheduler API (${options.apiUrl}):${colors.reset}`)
    const authResp = await prompts([
      {
        type: email ? null : 'text',
        name: 'email',
        message: 'Email:',
        initial: 'dev@dev.dev',
      },
      {
        type: password ? null : 'password',
        name: 'password',
        message: 'Пароль:',
      },
    ])

    email = email || authResp.email
    password = password || authResp.password
  }

  if (!email || !password) {
    console.error(`${colors.red}❌ Не указаны данные для входа.${colors.reset}`)
    process.exit(1)
  }

  return { email, password }
}
