import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { colors } from '../config/colors'
import { detectCandidateTargets, resolveTargetDir } from '../config/targets'
import { installRule, installSkill, syncSkillsSource } from '../lib/copy'
import { normalizeFsPath } from '../lib/path-utils'
import {
  checkInstalledSkills,
  DEFAULT_SOURCE_DIR,
  loadSourceRules,
  loadSourceSkills,
} from '../lib/registry'
import { validateTripFolder } from '../lib/validator'
import { parseCliArgs } from './args'
import { promptOverwriteConfirm, promptSkillsSelection, promptTargetLocation } from './interactive'

export async function runInstaller(): Promise<void> {
  const cliOptions = parseCliArgs()

  console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}   🤖 Agent Skills Installer & Obsidian Importer Suite${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════${colors.reset}\n`)

  const availableSkills = loadSourceSkills(DEFAULT_SOURCE_DIR)
  const availableRules = loadSourceRules(DEFAULT_SOURCE_DIR)

  // 1. Режим аудита папки тура (--check)
  if (cliOptions.checkPath) {
    const targetPath = normalizeFsPath(cliOptions.checkPath)
    console.log(`${colors.dim}🔍 Проверка готовности папки к импорту в Trip Scheduler:${colors.reset}`)
    console.log(`   ${colors.cyan}${targetPath}${colors.reset}\n`)

    if (!existsSync(targetPath)) {
      console.error(`${colors.red}❌ Ошибка: папка не существует: ${targetPath}${colors.reset}`)
      process.exit(1)
    }

    const report = validateTripFolder(targetPath)
    console.log(`${colors.bright}Результаты аудита для тура «${report.tripName}»:${colors.reset}`)
    console.log(`  • Оценка готовности: ${report.score >= 80 ? colors.green : report.score >= 50 ? colors.yellow : colors.red}${report.score}% (${report.passedChecks}/${report.totalChecks} проверок)${colors.reset}`)

    const readinessLabels = {
      'ready': `${colors.green}✔ Полностью готов к импорту (bun run import:obsidian)${colors.reset}`,
      'mostly-ready': `${colors.yellow}⚠ Частично готов (рекомендуется устранить предупреждения)${colors.reset}`,
      'needs-work': `${colors.red}❌ Требуется доработка структуры перед импортом${colors.reset}`,
    }
    console.log(`  • Статус:            ${readinessLabels[report.readinessForImporter]}\n`)

    for (const item of report.items) {
      const icon = item.status === 'pass' ? `${colors.green}✔` : item.status === 'warn' ? `${colors.yellow}⚠` : `${colors.red}✖`
      console.log(`  ${icon} ${item.message}${colors.reset}`)
      if (item.details) {
        console.log(`    ${colors.dim}↳ ${item.details}${colors.reset}`)
      }
    }

    console.log(`\n${colors.bright}💡 Команда для импорта этого тура:${colors.reset}`)
    console.log(`   ${colors.cyan}bun run import:obsidian -d "${targetPath}"${colors.reset}\n`)
    return
  }

  // 2. Режим вывода списка (--list)
  if (cliOptions.list) {
    console.log(`${colors.bright}Доступные навыки в каталоге:${colors.reset}\n`)
    for (const s of availableSkills) {
      const badge = s.isNew ? ` ${colors.bgGreen}${colors.black} НОВЫЙ ${colors.reset}` : ''
      console.log(`  ${colors.bright}${colors.cyan}• ${s.name}${badge}${colors.reset}`)
      console.log(`    ${colors.dim}${s.description}${colors.reset}`)
      console.log(`    ${colors.dim}Файлов: ${s.filesCount} (Примеры: ${s.hasExamples ? 'да' : 'нет'}, Справочники: ${s.hasReferences ? 'да' : 'нет'})${colors.reset}\n`)
    }

    if (availableRules.length > 0) {
      console.log(`${colors.bright}Доступные правила (.agents/rules):${colors.reset}\n`)
      for (const r of availableRules) {
        console.log(`  ${colors.bright}${colors.yellow}• ${r.filename}${colors.reset}`)
        console.log(`    ${colors.dim}${r.description}${colors.reset}\n`)
      }
    }
    return
  }

  // 3. Режим синхронизации исходных шаблонов (--sync-source)
  if (cliOptions.syncSource) {
    const vaultCandidates = detectCandidateTargets()
      .filter(t => t.id === 'obsidian-travel-vault')
    const defaultSyncPath = vaultCandidates[0]?.agentsDir ?? join(process.cwd(), '.agents')
    const syncFrom = normalizeFsPath(cliOptions.syncSourcePath || defaultSyncPath)

    console.log(`${colors.dim}🔄 Синхронизация шаблонов навыков из:${colors.reset}`)
    console.log(`   ${colors.cyan}${syncFrom}${colors.reset}\n`)

    if (!existsSync(syncFrom)) {
      console.error(`${colors.red}❌ Исходная папка не найдена: ${syncFrom}${colors.reset}`)
      process.exit(1)
    }

    const { skillsSynced, rulesSynced } = syncSkillsSource(syncFrom, DEFAULT_SOURCE_DIR)
    console.log(`${colors.green}✔ Успешно синхронизировано:${colors.reset}`)
    console.log(`  • Навыков: ${skillsSynced}`)
    console.log(`  • Правил:  ${rulesSynced}\n`)
    return
  }

  // 4. Определение целевой директории
  let targetLocationStr: string
  if (cliOptions.target) {
    targetLocationStr = normalizeFsPath(cliOptions.target)
  }
  else if (cliOptions.nonInteractive) {
    targetLocationStr = process.cwd()
  }
  else {
    targetLocationStr = await promptTargetLocation()
  }

  const { agentsDir, skillsDir, rulesDir } = resolveTargetDir(targetLocationStr)

  console.log(`\n${colors.dim}🎯 Папка назначения:${colors.reset}`)
  console.log(`   Навыки:  ${colors.cyan}${skillsDir}${colors.reset}`)
  console.log(`   Правила: ${colors.cyan}${rulesDir}${colors.reset}\n`)

  const installedSkills = checkInstalledSkills(skillsDir)
  // installedRules вычисляется лениво в promptSkillsSelection при интерактивном выборе

  // 5. Выбор навыков для установки
  let skillsToInstall: string[] = []
  let shouldInstallRules = cliOptions.includeRules ?? true

  if (cliOptions.all) {
    skillsToInstall = availableSkills.map(s => s.name)
    shouldInstallRules = cliOptions.includeRules !== false
  }
  else if (cliOptions.skills && cliOptions.skills.length > 0) {
    skillsToInstall = cliOptions.skills
  }
  else if (cliOptions.nonInteractive) {
    skillsToInstall = availableSkills.map(s => s.name)
  }
  else {
    const selection = await promptSkillsSelection(availableSkills, availableRules, installedSkills)
    skillsToInstall = selection.selectedSkills
    shouldInstallRules = selection.installRules
  }

  if (skillsToInstall.length === 0 && !shouldInstallRules) {
    console.log(`${colors.yellow}Не выбрано ни одного навыка или правила для установки.${colors.reset}\n`)
    return
  }

  if (!cliOptions.force && !cliOptions.nonInteractive && !cliOptions.all) {
    const confirmed = await promptOverwriteConfirm(skillsToInstall.length)
    if (!confirmed) {
      console.log(`\n${colors.yellow}Установка отменена пользователем.${colors.reset}\n`)
      return
    }
  }

  if (cliOptions.dryRun) {
    console.log(`\n${colors.yellow}🔍 [DRY-RUN] Режим предпросмотра включен. Файлы на диск записываться не будут.${colors.reset}\n`)
  }

  // 6. Выполнение установки навыков
  console.log(`${colors.bright}Копирование файлов навыков...${colors.reset}`)
  if (!cliOptions.dryRun) {
    mkdirSync(skillsDir, { recursive: true })
  }

  let totalFilesCopied = 0
  let totalFilesSkipped = 0

  for (const skillName of skillsToInstall) {
    const skillSource = join(DEFAULT_SOURCE_DIR, 'skills', skillName)
    const skillTarget = join(skillsDir, skillName)

    if (!existsSync(skillSource)) {
      console.log(`  ${colors.red}✖ Навык не найден в каталоге: ${skillName}${colors.reset}`)
      continue
    }

    const { copied, skipped } = installSkill(skillSource, skillTarget, cliOptions.dryRun, cliOptions.force)
    totalFilesCopied += copied
    totalFilesSkipped += skipped

    const actionText = copied > 0 ? `${colors.green}✔ ${skillName}${colors.reset} (${copied} файлов обновлено/скопировано)` : `${colors.dim}— ${skillName} (уже актуален, пропущено: ${skipped})${colors.reset}`

    console.log(`  ${actionText}`)
  }

  // 7. Выполнение установки правил
  if (shouldInstallRules && availableRules.length > 0) {
    console.log(`\n${colors.bright}Копирование системных правил путешествий...${colors.reset}`)
    if (!cliOptions.dryRun) {
      mkdirSync(rulesDir, { recursive: true })
    }

    for (const rule of availableRules) {
      const ruleTarget = join(rulesDir, rule.filename)
      const installed = installRule(rule.path, ruleTarget, cliOptions.dryRun, cliOptions.force)

      if (installed) {
        totalFilesCopied++
        console.log(`  ${colors.green}✔ ${rule.filename}${colors.reset} (${rule.description})`)
      }
      else {
        totalFilesSkipped++
        console.log(`  ${colors.dim}— ${rule.filename} (уже актуален, пропущен)${colors.reset}`)
      }
    }
  }

  // 8. Финальный отчет
  console.log(`\n${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bright}${colors.green}   🎉 Навыки успешно установлены!${colors.reset}`)
  console.log(`${colors.bright}${colors.green}════════════════════════════════════════════════════════════════════${colors.reset}`)
  console.log(`  • Установлено файлов: ${totalFilesCopied}`)
  console.log(`  • Пропущено (без изменений): ${totalFilesSkipped}`)
  console.log(`  • Директория: ${colors.cyan}${agentsDir}${colors.reset}\n`)

  console.log(`${colors.bright}Рекомендованные следующие шаги:${colors.reset}`)
  console.log(`  1. Попросите агента составить или дополнить маршрут в Obsidian:`)
  console.log(`     ${colors.dim}«Используй навыки travel-vault-architect и travel-itinerary-enricher...»${colors.reset}`)
  console.log(`  2. Проверьте качество оформления тура перед импортом:`)
  console.log(`     ${colors.cyan}bun run skills:install --check "<путь_к_папке_тура>"${colors.reset}`)
  console.log(`  3. Запустите импорт тура в Trip Scheduler:`)
  console.log(`     ${colors.cyan}bun run import:obsidian${colors.reset}\n`)
}
