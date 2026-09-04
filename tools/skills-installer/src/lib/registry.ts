import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface SkillItem {
  name: string
  title: string
  description: string
  path: string
  filesCount: number
  hasExamples: boolean
  hasReferences: boolean
  isNew?: boolean
}

export interface RuleItem {
  name: string
  filename: string
  description: string
  path: string
}

const __filename: string = fileURLToPath(import.meta.url)
const __dirname: string = dirname(__filename)
export const DEFAULT_SOURCE_DIR: string = join(__dirname, '../../source')

export function parseSkillFrontmatter(skillMdPath: string): { name: string, description: string, title?: string } {
  if (!existsSync(skillMdPath)) {
    return { name: basename(dirname(skillMdPath)), description: '' }
  }

  const content = readFileSync(skillMdPath, 'utf-8')
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)

  let name = basename(dirname(skillMdPath))
  let description = ''

  if (fmMatch) {
    const yamlLines = fmMatch[1].split(/\r?\n/)
    for (let i = 0; i < yamlLines.length; i++) {
      const line = yamlLines[i].trim()
      if (line.startsWith('name:')) {
        name = line.slice(5).trim()
      }
      else if (line.startsWith('description:')) {
        const afterColon = line.slice(12).replace(/^>-\s*/, '').trim()
        const descParts: string[] = afterColon ? [afterColon] : []
        while (i + 1 < yamlLines.length && !/^[a-z_]+:/i.test(yamlLines[i + 1])) {
          i++
          const nextTrimmed = yamlLines[i].trim()
          if (nextTrimmed) {
            descParts.push(nextTrimmed)
          }
        }
        description = descParts.join(' ')
      }
    }
  }

  const h1Match = content.match(/^#[ \t]+([^\r\n]+)/m)
  const title = h1Match ? h1Match[1].trim() : name

  return { name, description, title }
}

export function loadSourceSkills(sourceDir: string = DEFAULT_SOURCE_DIR): SkillItem[] {
  const skillsDir = join(sourceDir, 'skills')
  if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
    return []
  }

  const skills: SkillItem[] = []
  const entries = readdirSync(skillsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const skillPath = join(skillsDir, entry.name)
      const skillMd = join(skillPath, 'SKILL.md')

      if (existsSync(skillMd)) {
        const { name, description, title } = parseSkillFrontmatter(skillMd)
        const examplesPath = join(skillPath, 'examples')
        const referencesPath = join(skillPath, 'references')

        let filesCount = 1
        if (existsSync(examplesPath)) {
          filesCount += readdirSync(examplesPath).length
        }
        if (existsSync(referencesPath)) {
          filesCount += readdirSync(referencesPath).length
        }

        skills.push({
          name,
          title: title || name,
          description: description || 'Нет описания',
          path: skillPath,
          filesCount,
          hasExamples: existsSync(examplesPath),
          hasReferences: existsSync(referencesPath),
          isNew: name === 'travel-importer-compatibility',
        })
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

export function loadSourceRules(sourceDir: string = DEFAULT_SOURCE_DIR): RuleItem[] {
  const rulesDir = join(sourceDir, 'rules')
  if (!existsSync(rulesDir) || !statSync(rulesDir).isDirectory()) {
    return []
  }

  const rules: RuleItem[] = []
  const entries = readdirSync(rulesDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const rulePath = join(rulesDir, entry.name)
      const content = readFileSync(rulePath, 'utf-8')
      const h1Match = content.match(/^#[ \t]+([^\r\n]+)/m)
      const title = h1Match ? h1Match[1].trim() : entry.name

      rules.push({
        name: entry.name.replace(/\.md$/, ''),
        filename: entry.name,
        description: title,
        path: rulePath,
      })
    }
  }

  return rules
}

export function checkInstalledSkills(targetSkillsDir: string): Map<string, boolean> {
  const installed = new Map<string, boolean>()
  if (!existsSync(targetSkillsDir) || !statSync(targetSkillsDir).isDirectory()) {
    return installed
  }

  try {
    const entries = readdirSync(targetSkillsDir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory() && existsSync(join(targetSkillsDir, e.name, 'SKILL.md'))) {
        installed.set(e.name, true)
      }
    }
  }
  catch {
    // ignore
  }

  return installed
}

export function checkInstalledRules(targetRulesDir: string): Map<string, boolean> {
  const installed = new Map<string, boolean>()
  if (!existsSync(targetRulesDir) || !statSync(targetRulesDir).isDirectory()) {
    return installed
  }

  try {
    const entries = readdirSync(targetRulesDir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.md')) {
        installed.set(e.name, true)
      }
    }
  }
  catch {
    // ignore
  }

  return installed
}
