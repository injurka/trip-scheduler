import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface CopyResult {
  skillsCopied: string[]
  skillsSkipped: string[]
  rulesCopied: string[]
  rulesSkipped: string[]
  totalFiles: number
}

function areFilesIdentical(src: string, dest: string): boolean {
  if (!existsSync(dest))
    return false
  try {
    const srcBuf = readFileSync(src)
    const destBuf = readFileSync(dest)
    return srcBuf.equals(destBuf)
  }
  catch {
    return false
  }
}

function copyDirectoryRecursive(src: string, dest: string, dryRun: boolean, force: boolean): { copied: number, skipped: number } {
  let copied = 0
  let skipped = 0

  if (!existsSync(dest) && !dryRun) {
    mkdirSync(dest, { recursive: true })
  }

  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      const res = copyDirectoryRecursive(srcPath, destPath, dryRun, force)
      copied += res.copied
      skipped += res.skipped
    }
    else if (entry.isFile()) {
      if (!force && areFilesIdentical(srcPath, destPath)) {
        skipped++
      }
      else {
        if (!dryRun) {
          mkdirSync(dirname(destPath), { recursive: true })
          copyFileSync(srcPath, destPath)
        }
        copied++
      }
    }
  }

  return { copied, skipped }
}

export function installSkill(skillSourcePath: string, skillTargetDir: string, dryRun = false, force = false): { copied: number, skipped: number } {
  return copyDirectoryRecursive(skillSourcePath, skillTargetDir, dryRun, force)
}

export function installRule(ruleSourcePath: string, ruleTargetFile: string, dryRun = false, force = false): boolean {
  if (!force && areFilesIdentical(ruleSourcePath, ruleTargetFile)) {
    return false
  }

  if (!dryRun) {
    mkdirSync(dirname(ruleTargetFile), { recursive: true })
    copyFileSync(ruleSourcePath, ruleTargetFile)
  }
  return true
}

export function syncSkillsSource(fromExternalAgentsDir: string, toBundledSourceDir: string): { skillsSynced: number, rulesSynced: number } {
  const externalSkills = join(fromExternalAgentsDir, 'skills')
  const externalRules = join(fromExternalAgentsDir, 'rules')
  const bundledSkills = join(toBundledSourceDir, 'skills')
  const bundledRules = join(toBundledSourceDir, 'rules')

  let skillsSynced = 0
  let rulesSynced = 0

  if (existsSync(externalSkills)) {
    const entries = readdirSync(externalSkills, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory()) {
        copyDirectoryRecursive(join(externalSkills, e.name), join(bundledSkills, e.name), false, true)
        skillsSynced++
      }
    }
  }

  if (existsSync(externalRules)) {
    const entries = readdirSync(externalRules, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.md')) {
        mkdirSync(bundledRules, { recursive: true })
        copyFileSync(join(externalRules, e.name), join(bundledRules, e.name))
        rulesSynced++
      }
    }
  }

  return { skillsSynced, rulesSynced }
}
