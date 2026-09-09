import type { CliOptions, ParsedTripData } from '../types'
import { basename } from 'node:path'
import process from 'node:process'
import prompts from 'prompts'
import { colors } from '../config/colors'
import { AIHUBMIX_MODELS, DEFAULT_AIHUBMIX_MODEL } from '../config/constants'
import { getConfig } from '../config/loader'
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
        type: 'autocomplete',
        name: 'folder',
        message: 'Выберите папку путешествия из найденных в Obsidian Vault (начните вводить для поиска):',
        choices,
      })

      if (!resp.folder) {
        console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
        process.exit(0)
      }

      if (resp.folder === 'custom') {
        const customResp = await prompts({
          type: 'text',
          name: 'folder',
          message: 'Введите полный путь к папке путешествия:',
        })
        if (!customResp.folder) {
          console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
          process.exit(0)
        }
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
      if (!resp.folder) {
        console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
        process.exit(0)
      }
      targetDir = resp.folder
    }
  }

  if (!targetDir) {
    console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
    process.exit(0)
  }

  return normalizeVaultPath(targetDir)
}

export async function promptForExecutionMode(): Promise<'validate' | 'import' | 'dry-run'> {
  const resp = await prompts({
    type: 'select',
    name: 'mode',
    message: 'Выберите режим работы с хранилищем Obsidian:',
    choices: [
      {
        title: '🔍 Валидация и диагностика хранилища (проверка структуры, предупреждения и упущенные данные)',
        description: 'Глубокий аудит без записи в базу: проверка таймлайна, битых фото, метаданных и карт',
        value: 'validate',
      },
      {
        title: '🚀 Полный импорт в Trip Scheduler',
        description: 'Создание/синхронизация поездки, дней, активностей, бронирований и чек-листов в веб-платформу',
        value: 'import',
      },
      {
        title: '📄 Быстрый предпросмотр структуры (Dry-run)',
        description: 'Краткая сводка распознанных модулей без глубокого аудита',
        value: 'dry-run',
      },
    ],
    initial: 0,
  })

  if (!resp.mode) {
    console.log(`\n${colors.yellow}Действие отменено.${colors.reset}\n`)
    process.exit(0)
  }

  return resp.mode
}

export async function promptForContinueToImport(defaultInitial: boolean = true): Promise<boolean> {
  const resp = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: defaultInitial
      ? 'Хотите сразу перейти к импорту этих данных в Trip Scheduler?'
      : 'Обнаружены критические ошибки. Всё равно продолжить импорт?',
    initial: defaultInitial,
  })

  return !!resp.proceed
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

      if (!modeResp.mode) {
        console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
        process.exit(0)
      }

      useLlm = modeResp.mode === 'llm'

      if (useLlm && !cliOptions.llmModel) {
        const availableModels = getConfig().models || AIHUBMIX_MODELS
        const modelResp = await prompts({
          type: 'select',
          name: 'model',
          message: 'Выберите модель AIHubMix / OpenAI для обработки:',
          choices: availableModels.map(m => ({ title: m.title, value: m.value })),
          initial: 0,
        })

        if (!modelResp.model) {
          console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
          process.exit(0)
        }

        if (modelResp.model === 'custom') {
          const customModelResp = await prompts({
            type: 'text',
            name: 'customModel',
            message: 'Введите идентификатор модели (например, gemini-3.8-flash, claude-sonnet-5, gpt-5.6-terra):',
            initial: getConfig().defaultModel || DEFAULT_AIHUBMIX_MODEL,
          })
          if (!customModelResp.customModel) {
            console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
            process.exit(0)
          }
          selectedModel = customModelResp.customModel?.trim() || getConfig().defaultModel || DEFAULT_AIHUBMIX_MODEL
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

export async function promptForTargetTrip(
  api: { getTrips: (tab?: 'my' | 'public') => Promise<Array<{ id: string, title: string, startDate?: string, endDate?: string, status?: string, cities?: string[], days?: any[] }>> },
  cliTripId?: string,
  vaultTripTitle?: string,
): Promise<{ tripId?: string, isNew: boolean, overwriteDays: boolean }> {
  if (cliTripId) {
    return { tripId: cliTripId, isNew: false, overwriteDays: false }
  }

  let userTrips: Array<{ id: string, title: string, startDate?: string, endDate?: string, status?: string, cities?: string[], days?: any[] }> = []
  try {
    userTrips = await api.getTrips('my')
  }
  catch {
    userTrips = []
  }

  if (!userTrips || userTrips.length === 0) {
    return { isNew: true, overwriteDays: false }
  }

  const choices: Array<{ title: string, value: string, description?: string }> = [
    {
      title: `✨ Создать новое путешествие («${vaultTripTitle || 'Новое'}»)`,
      value: 'new',
      description: 'Создать новую поездку в базе Trip Scheduler с нуля',
    },
  ]

  // If there's an existing trip with a matching or similar name, recommend it
  for (const t of userTrips) {
    const isMatching = vaultTripTitle && (t.title.toLowerCase().includes(vaultTripTitle.toLowerCase()) || vaultTripTitle.toLowerCase().includes(t.title.toLowerCase()))
    const descParts: string[] = []
    if (t.startDate)
      descParts.push(`с ${t.startDate}`)
    if (t.status)
      descParts.push(`статус: ${t.status}`)
    if (t.cities && t.cities.length > 0)
      descParts.push(t.cities.slice(0, 3).join(', '))
    if (Array.isArray(t.days) && t.days.length > 0)
      descParts.push(`${t.days.length} дн.`)

    choices.push({
      title: `${isMatching ? '🎯 (Совпадение) ' : '📌 '}${t.title}`,
      value: t.id,
      description: descParts.length > 0 ? descParts.join(' • ') : `ID: ${t.id}`,
    })
  }

  choices.push({
    title: '🔑 Ввести Trip ID вручную...',
    value: 'custom',
    description: 'Указать UUID существующего путешествия',
  })

  const selection = await prompts({
    type: 'select',
    name: 'action',
    message: 'Куда импортировать данные?',
    choices,
    initial: 0,
  })

  if (!selection.action) {
    console.log(`${colors.yellow}Импорт отменен.${colors.reset}`)
    process.exit(0)
  }

  if (selection.action === 'new') {
    return { isNew: true, overwriteDays: false }
  }

  let chosenTripId = selection.action
  if (chosenTripId === 'custom') {
    const customResp = await prompts({
      type: 'text',
      name: 'id',
      message: 'Введите UUID существующего путешествия (Trip ID):',
      validate: (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()) ? true : 'Некорректный UUID формат',
    })
    if (!customResp.id) {
      console.log(`${colors.yellow}Импорт отменен.${colors.reset}`)
      process.exit(0)
    }
    chosenTripId = customResp.id.trim()
  }

  // Ask about days strategy
  const daysResp = await prompts({
    type: 'select',
    name: 'strategy',
    message: 'Как поступить с днями маршрута в существующем путешествии?',
    choices: [
      {
        title: '🧹 Заменить дни полностью (удалить старые дни/активности и загрузить заново)',
        value: 'overwrite',
        description: 'Рекомендуется: гарантирует актуальность таймлайна без дубликатов',
      },
      {
        title: '🔄 Обновить/дополнить существующие дни по датам',
        value: 'sync',
        description: 'Сохранить существующие дни и накатить обновления',
      },
    ],
    initial: 0,
  })

  if (!daysResp.strategy) {
    console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
    process.exit(0)
  }

  let overwriteDays = daysResp.strategy === 'overwrite'

  if (overwriteDays) {
    const confirmOverwrite = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: '⚠️  Внимание! Старые дни и активности в этом путешествии будут безвозвратно удалены. Продолжить?',
      initial: true,
    })

    if (confirmOverwrite.confirmed === undefined) {
      console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
      process.exit(0)
    }

    if (!confirmOverwrite.confirmed) {
      overwriteDays = false
      console.log(`  ${colors.cyan}ℹ️ Переключено в режим дополнения (sync) без удаления старых дней.${colors.reset}`)
    }
  }

  return {
    tripId: chosenTripId,
    isNew: false,
    overwriteDays,
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
    console.log(`\n${colors.yellow}Импорт отменен.${colors.reset}\n`)
    process.exit(0)
  }

  return { email, password }
}
