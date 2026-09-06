import type { RuleItem, SkillItem } from '../lib/registry'
import process from 'node:process'
import prompts from 'prompts'
import { colors } from '../config/colors'
import { detectCandidateTargets } from '../config/targets'
import { normalizeFsPath } from '../lib/path-utils'

export async function promptTargetLocation(explicitTarget?: string): Promise<string> {
  if (explicitTarget) {
    return normalizeFsPath(explicitTarget)
  }

  const candidates = detectCandidateTargets()
  const choices: prompts.Choice[] = candidates.map(c => ({
    title: c.title,
    description: `${c.description}${c.exists ? '' : ' (папка будет создана)'}`,
    value: c.agentsDir,
  }))

  choices.push({
    title: '✏️  Ввести свой путь вручную...',
    description: 'Указать пользовательскую директорию проекта или хранилища',
    value: '__custom__',
  })

  const res = await prompts({
    type: 'select',
    name: 'target',
    message: 'Куда установить навыки для агента?',
    choices,
    initial: 0,
  })

  if (!res.target) {
    console.log(`\n${colors.yellow}Операция отменена пользователем.${colors.reset}`)
    process.exit(0)
  }

  if (res.target === '__custom__') {
    const customRes = await prompts({
      type: 'text',
      name: 'path',
      message: 'Введите путь к папке проекта или хранилища Obsidian:',
      validate: (val: string) => val.trim().length > 0 ? true : 'Путь не может быть пустым',
    })

    if (!customRes.path) {
      console.log(`\n${colors.yellow}Операция отменена пользователем.${colors.reset}`)
      process.exit(0)
    }

    return normalizeFsPath(customRes.path)
  }

  return res.target
}

export async function promptSkillsSelection(
  availableSkills: SkillItem[],
  availableRules: RuleItem[],
  installedSkills: Map<string, boolean>,
): Promise<{ selectedSkills: string[], installRules: boolean }> {
  const choices: prompts.Choice[] = availableSkills.map((s) => {
    const isInstalled = installedSkills.has(s.name)
    const newBadge = s.isNew ? ` ${colors.green}[НОВЫЙ]${colors.reset}` : ''
    const status = isInstalled ? ` ${colors.dim}(уже установлен)${colors.reset}` : ''

    return {
      title: `${s.name}${newBadge}${status}`,
      description: `${s.title} (${s.filesCount} файлов)`,
      value: s.name,
      selected: true, // По умолчанию выбираем все
    }
  })

  const skillsRes = await prompts({
    type: 'multiselect',
    name: 'skills',
    message: 'Выберите навыки для установки:',
    choices,
    hint: '- Пробел для переключения, Enter для подтверждения',
    instructions: false,
  })

  if (!skillsRes.skills) {
    console.log(`\n${colors.yellow}Операция отменена пользователем.${colors.reset}`)
    process.exit(0)
  }

  let installRules = true
  if (availableRules.length > 0) {
    const rulesRes = await prompts({
      type: 'confirm',
      name: 'rules',
      message: `Установить также системные правила путешествий (.agents/rules/travel-vault.md)?`,
      initial: true,
    })
    installRules = rulesRes.rules ?? true
  }

  return {
    selectedSkills: skillsRes.skills,
    installRules,
  }
}

export async function promptOverwriteConfirm(itemCount: number): Promise<boolean> {
  const res = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: `Готовы установить/обновить ${itemCount} навыков?`,
    initial: true,
  })

  return res.confirmed ?? false
}
