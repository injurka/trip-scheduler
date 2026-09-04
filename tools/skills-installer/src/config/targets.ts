import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { discoverVaultFolders, normalizeFsPath } from '../../../../packages/vault-locator/src/index'

export interface TargetLocation {
  id: string
  title: string
  description: string
  path: string
  agentsDir: string
  skillsDir: string
  rulesDir: string
  exists: boolean
  isDefault?: boolean
}

/** Регистрирует цель установки навыков в директорию Obsidian-вольта (папка <agents>/skills|rules). */
function pushVaultTarget(targets: TargetLocation[], location: { path: string, vaultRoot: string }, label: string): void {
  const vaultAgents = join(location.path, '.agents')
  targets.push({
    id: 'obsidian-travel-vault',
    title: `💎 Obsidian Travel Vault (${label})`,
    description: `${vaultAgents}`,
    path: location.path,
    agentsDir: vaultAgents,
    skillsDir: join(vaultAgents, 'skills'),
    rulesDir: join(vaultAgents, 'rules'),
    exists: true,
  })
}

export function detectCandidateTargets(): TargetLocation[] {
  const targets: TargetLocation[] = []
  const home = homedir()
  const cwd = process.cwd()

  // 1. Текущий репозиторий / воркспейс
  const workspaceAgentsDir = join(cwd, '.agents')
  targets.push({
    id: 'project-workspace',
    title: '📂 Текущий проект (Trip Scheduler Workspace)',
    description: `${workspaceAgentsDir}`,
    path: cwd,
    agentsDir: workspaceAgentsDir,
    skillsDir: join(workspaceAgentsDir, 'skills'),
    rulesDir: join(workspaceAgentsDir, 'rules'),
    exists: existsSync(cwd),
    isDefault: true,
  })

  // 2. Obsidian Travel Vault — автоматическое обнаружение по реестру Obsidian и маркерам .obsidian
  const vaultFolders = discoverVaultFolders('Travel')
  for (const location of vaultFolders) {
    const label = location.path.slice(location.vaultRoot.length + 1) || location.name
    pushVaultTarget(targets, location, label)
  }

  // 3. Antigravity Agent Global directory
  const antigravityGlobal = join(home, '.gemini/antigravity-cli')
  if (existsSync(antigravityGlobal)) {
    const globalAgents = join(home, '.gemini/config')
    targets.push({
      id: 'antigravity-global',
      title: '🌐 Antigravity Global Agent Config',
      description: `${globalAgents}`,
      path: antigravityGlobal,
      agentsDir: globalAgents,
      skillsDir: join(globalAgents, 'skills'),
      rulesDir: join(globalAgents, 'rules'),
      exists: true,
    })
  }

  // 4. Домашняя папка пользователя (~/.agents)
  const userHomeAgents = join(home, '.agents')
  targets.push({
    id: 'user-home',
    title: '🏠 Пользовательская папка (~/.agents)',
    description: `${userHomeAgents}`,
    path: home,
    agentsDir: userHomeAgents,
    skillsDir: join(userHomeAgents, 'skills'),
    rulesDir: join(userHomeAgents, 'rules'),
    exists: existsSync(userHomeAgents),
  })

  return targets
}

export function resolveTargetDir(rawTarget?: string): { agentsDir: string, skillsDir: string, rulesDir: string } {
  if (!rawTarget) {
    const defaultTarget = detectCandidateTargets()[0]
    return {
      agentsDir: defaultTarget.agentsDir,
      skillsDir: defaultTarget.skillsDir,
      rulesDir: defaultTarget.rulesDir,
    }
  }

  const normalized = normalizeFsPath(rawTarget)
  // Если пользователь передал путь, который уже заканчивается на .agents
  if (normalized.endsWith('/.agents') || normalized.endsWith('\\.agents')) {
    return {
      agentsDir: normalized,
      skillsDir: join(normalized, 'skills'),
      rulesDir: join(normalized, 'rules'),
    }
  }

  // Если путь заканчивается на skills
  if (normalized.endsWith('/skills') || normalized.endsWith('\\skills')) {
    const parent = join(normalized, '..')
    return {
      agentsDir: parent,
      skillsDir: normalized,
      rulesDir: join(parent, 'rules'),
    }
  }

  // Обычная директория проекта или хранилища
  const agentsDir = join(normalized, '.agents')
  return {
    agentsDir,
    skillsDir: join(agentsDir, 'skills'),
    rulesDir: join(agentsDir, 'rules'),
  }
}
