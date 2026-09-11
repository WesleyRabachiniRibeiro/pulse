import { spawn, type ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { ProcessRunner, SpawnResult } from '../../ports/process-runner'

export class WindowsProcessRunner implements ProcessRunner {
  private readonly wingetProcesses = new Map<string, ChildProcess>()
  private cachedPath: string | null = null

  constructor(private readonly powershell: PowerShellRunner) {}

  async runOnce(exe: string, args: readonly string[]): Promise<SpawnResult> {
    return new Promise((resolve) => {
      const child = spawn(exe, [...args], { windowsHide: true })

      let text = ''
      const consume = (raw: Buffer): void => {
        text += raw.toString('utf8')
      }
      child.stdout?.on('data', consume)
      child.stderr?.on('data', consume)

      child.on('error', (e) => resolve({ code: -1, text: `${text}\n${e.message}` }))
      child.on('close', (code) => resolve({ code: code ?? -1, text }))
    })
  }

  async runWinget(
    id: string,
    args: readonly string[],
    onLine: (line: string) => void,
    drive?: string,
  ): Promise<SpawnResult> {
    const env = await this.wingetEnv(drive)

    return new Promise((resolve) => {
      const child = spawn('winget', [...args], {
        windowsHide: true,
        ...(env ? { env } : {}),
      })
      this.wingetProcesses.set(id, child)

      let text = ''
      const consume = (raw: Buffer): void => {
        const chunk = raw.toString('utf8')
        text += chunk
        for (const line of chunk.split(/[\r\n]+/)) {
          if (line.trim()) onLine(line.trim())
        }
      }

      child.stdout?.on('data', consume)
      child.stderr?.on('data', consume)

      child.on('error', (e) => {
        this.wingetProcesses.delete(id)
        resolve({ code: -1, text: `${text}\n${e.message}` })
      })
      child.on('close', (code) => {
        this.wingetProcesses.delete(id)
        resolve({ code: code ?? -1, text })
      })
    })
  }

  killWinget(id?: string): void {
    const targets = id ? [this.wingetProcesses.get(id)] : [...this.wingetProcesses.values()]
    for (const child of targets) {
      if (child?.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
      }
    }
  }

  private async wingetEnv(drive?: string): Promise<NodeJS.ProcessEnv | undefined> {
    if (!drive) return undefined

    const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()
    if (drive.toUpperCase() === system) return undefined

    const { mkdir } = await import('node:fs/promises')
    const folder = `${drive}\\Pulse\\temp`
    try {
      await mkdir(folder, { recursive: true })
    } catch {
      return undefined
    }

    const env: NodeJS.ProcessEnv = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (!/^(temp|tmp)$/i.test(key)) env[key] = value
    }
    env['TEMP'] = folder
    env['TMP'] = folder
    return env
  }

  async run(exe: string, args: readonly string[]): Promise<boolean> {
    const env = await this.toolEnv()
    const isScript = /\.(cmd|bat)$/i.test(exe)

    return new Promise((resolve) => {
      const child = isScript
        ? spawn(exe, [...args], { windowsHide: true, shell: true, env })
        : spawn(exe, [...args], { windowsHide: true, env })
      child.on('error', () => resolve(false))
      child.on('close', (code) => resolve(code === 0))
    })
  }

  async launchDetached(exe: string, args: readonly string[]): Promise<void> {
    const env = await this.toolEnv()
    return new Promise((resolve) => {
      const child = spawn(exe, [...args], {
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
        env,
      })
      child.on('error', () => resolve())
      child.unref()
      resolve()
    })
  }

  async runCommandLine(line: string): Promise<boolean> {
    const env = await this.toolEnv()
    return new Promise((resolve) => {
      const child = spawn(process.env['ComSpec'] ?? 'cmd.exe', ['/d', '/s', '/c', line], {
        windowsHide: true,
        env,
      })
      child.on('error', () => resolve(false))
      child.on('close', (code) => resolve(code === 0))
    })
  }

  async openUri(uri: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('cmd', ['/c', 'start', '', uri], { windowsHide: true })
      child.on('error', () => resolve(false))
      child.on('close', (code) => resolve(code === 0))
    })
  }

  async runElevated(
    exe: string,
    args: readonly string[],
    timeoutMs = 10 * 60_000,
  ): Promise<SpawnResult> {
    return this.powershell.runJson<SpawnResult>(
      'Run-AsAdmin.ps1',
      { exe, args: [...args], timeoutMs },
      timeoutMs + 30_000,
    )
  }

  async runAsInteractiveUser(
    exe: string,
    args: readonly string[],
    timeoutMs = 10 * 60_000,
  ): Promise<SpawnResult> {
    return this.powershell.runJson<SpawnResult>(
      'Run-AsInteractiveUser.ps1',
      { exe, args: [...args], timeoutMs },
      timeoutMs + 30_000,
    )
  }

  private elevated: boolean | null = null

  async isElevated(): Promise<boolean> {
    if (this.elevated === null) {
      const { elevated } = await this.powershell.runJson<{ elevated: boolean }>('Test-Elevated.ps1')
      this.elevated = elevated
    }
    return this.elevated
  }

  forgetPathCache(): void {
    this.cachedPath = null
  }

  private async currentPath(): Promise<string> {
    if (this.cachedPath !== null) return this.cachedPath

    const { path: fromRegistry } = await this.powershell.runJson<{ path: string }>(
      'Get-ToolPath.ps1',
    )
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

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  private async locate(fileName: string, candidates: readonly string[]): Promise<string | null> {
    for (const candidate of candidates) {
      if (candidate && (await this.exists(candidate))) return candidate
    }

    for (const folder of (await this.currentPath()).split(';')) {
      if (!folder) continue
      const full = join(folder, fileName)
      if (await this.exists(full)) return full
    }

    return null
  }

  private under(variable: string, ...parts: string[]): string {
    const base = process.env[variable]
    return base ? join(base, ...parts) : ''
  }

  locateVsCode(): Promise<string | null> {
    return this.locate('code.cmd', [
      this.under('LOCALAPPDATA', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      this.under('ProgramFiles', 'Microsoft VS Code', 'bin', 'code.cmd'),
      this.under('ProgramFiles(x86)', 'Microsoft VS Code', 'bin', 'code.cmd'),
    ])
  }

  locateGit(): Promise<string | null> {
    return this.locate('git.exe', [
      this.under('ProgramFiles', 'Git', 'cmd', 'git.exe'),
      this.under('ProgramFiles(x86)', 'Git', 'cmd', 'git.exe'),
      this.under('LOCALAPPDATA', 'Programs', 'Git', 'cmd', 'git.exe'),
    ])
  }
}
