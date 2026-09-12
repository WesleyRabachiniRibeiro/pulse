import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { ProcessRunner } from '../../ports/process-runner'
import type { Tool, Toolchain } from '../../ports/toolchain'

const CANDIDATES: Readonly<Record<Tool, readonly [string, readonly string[][]]>> = {
  vscode: [
    'code.cmd',
    [
      ['LOCALAPPDATA', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'],
      ['ProgramFiles', 'Microsoft VS Code', 'bin', 'code.cmd'],
      ['ProgramFiles(x86)', 'Microsoft VS Code', 'bin', 'code.cmd'],
    ],
  ],
  git: [
    'git.exe',
    [
      ['ProgramFiles', 'Git', 'cmd', 'git.exe'],
      ['ProgramFiles(x86)', 'Git', 'cmd', 'git.exe'],
      ['LOCALAPPDATA', 'Programs', 'Git', 'cmd', 'git.exe'],
    ],
  ],
  npm: [
    'npm.cmd',
    [
      ['ProgramFiles', 'nodejs', 'npm.cmd'],
      ['APPDATA', 'npm', 'npm.cmd'],
    ],
  ],
  python: [
    'python.exe',
    [
      ['LOCALAPPDATA', 'Programs', 'Python', 'Python313', 'python.exe'],
      ['LOCALAPPDATA', 'Programs', 'Python', 'Python312', 'python.exe'],
    ],
  ],
}

export class WindowsToolchain implements Toolchain {
  private cachedPath: string | null = null

  constructor(
    private readonly powershell: PowerShellRunner,
    private readonly processRunner: ProcessRunner,
  ) {}

  async locate(tool: Tool): Promise<string | null> {
    const [fileName, places] = CANDIDATES[tool]

    for (const parts of places) {
      const candidate = this.under(parts)
      if (candidate && (await this.exists(candidate))) return candidate
    }

    for (const folder of (await this.currentPath()).split(';')) {
      if (!folder) continue
      const full = join(folder, fileName)
      if (await this.exists(full)) return full
    }

    return null
  }

  async run(exe: string, args: readonly string[]): Promise<boolean> {
    return this.processRunner.run(exe, args, await this.toolEnv())
  }

  async read(exe: string, args: readonly string[]): Promise<string> {
    const { text } = await this.processRunner.runOnce(exe, args, await this.toolEnv())
    return text.trim()
  }

  forgetPath(): void {
    this.cachedPath = null
  }

  private under(parts: readonly string[]): string {
    const [variable, ...rest] = parts
    const base = variable ? process.env[variable] : undefined
    return base ? join(base, ...rest) : ''
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  // O PATH da sessão é o de quando o Pulse abriu. O do registro é o de agora,
  // e é ele que enxerga o que acabou de ser instalado.
  private async currentPath(): Promise<string> {
    if (this.cachedPath !== null) return this.cachedPath

    const { path: fromRegistry } = await this.powershell.runJson<{ path: string }>('Get-ToolPath.ps1')
    const seen = new Set<string>()
    const folders: string[] = []

    for (const part of [...(process.env['PATH'] ?? '').split(';'), ...fromRegistry.split(';')]) {
      const folder = part.trim().replace(/[\\/]+$/, '')
      if (!folder) continue
      const key = folder.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      folders.push(folder)
    }

    this.cachedPath = folders.join(';')
    return this.cachedPath
  }

  private async toolEnv(): Promise<NodeJS.ProcessEnv> {
    const env: NodeJS.ProcessEnv = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (!/^path$/i.test(key)) env[key] = value
    }
    env['PATH'] = await this.currentPath()
    return env
  }
}
