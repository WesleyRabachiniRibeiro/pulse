import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'

const PATH_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$machine = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment' -Name Path).Path
$user = (Get-ItemProperty 'HKCU:\\Environment' -Name Path).Path
@($machine, $user) -join ';'
`

function powershellOut(script: string): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true },
    )
    let output = ''
    child.stdout?.on('data', (b: Buffer) => (output += b.toString('utf8')))
    child.on('error', () => resolve(''))
    child.on('close', () => resolve(output.trim()))
  })
}

let cachedPath: string | null = null

export function forgetPath(): void {
  cachedPath = null
}

export async function currentPath(): Promise<string> {
  if (cachedPath !== null) return cachedPath

  const fromRegistry = await powershellOut(PATH_SCRIPT)
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

  cachedPath = folders.join(';')
  return cachedPath
}

async function toolEnv(): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^path$/i.test(key)) env[key] = value
  }
  env['PATH'] = await currentPath()
  return env
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function locate(file: string, candidates: readonly string[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (candidate && (await exists(candidate))) return candidate
  }

  for (const folder of (await currentPath()).split(';')) {
    if (!folder) continue
    const full = join(folder, file)
    if (await exists(full)) return full
  }

  return null
}

function under(variable: string, ...parts: string[]): string {
  const base = process.env[variable]
  return base ? join(base, ...parts) : ''
}

export function locateVsCode(): Promise<string | null> {
  return locate('code.cmd', [
    under('LOCALAPPDATA', 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    under('ProgramFiles', 'Microsoft VS Code', 'bin', 'code.cmd'),
    under('ProgramFiles(x86)', 'Microsoft VS Code', 'bin', 'code.cmd'),
  ])
}

export function locateGit(): Promise<string | null> {
  return locate('git.exe', [
    under('ProgramFiles', 'Git', 'cmd', 'git.exe'),
    under('ProgramFiles(x86)', 'Git', 'cmd', 'git.exe'),
    under('LOCALAPPDATA', 'Programs', 'Git', 'cmd', 'git.exe'),
  ])
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function runLine(line: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(process.env['ComSpec'] ?? 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
      windowsHide: true,
      windowsVerbatimArguments: true,
      env,
    })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

export async function runTool(exe: string, args: readonly string[]): Promise<boolean> {
  const env = await toolEnv()
  return runLine([exe, ...args].map(quote).join(' '), env)
}

export async function runCommandLine(line: string): Promise<boolean> {
  return runLine(line, await toolEnv())
}
