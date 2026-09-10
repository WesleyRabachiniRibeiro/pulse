import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { currentPath } from './environment'

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

export function locateNpm(): Promise<string | null> {
  return locate('npm.cmd', [
    under('ProgramFiles', 'nodejs', 'npm.cmd'),
    under('APPDATA', 'npm', 'npm.cmd'),
  ])
}

export function locatePython(): Promise<string | null> {
  return locate('python.exe', [
    under('LOCALAPPDATA', 'Programs', 'Python', 'Python313', 'python.exe'),
    under('LOCALAPPDATA', 'Programs', 'Python', 'Python312', 'python.exe'),
  ])
}

export function locateGit(): Promise<string | null> {
  return locate('git.exe', [
    under('ProgramFiles', 'Git', 'cmd', 'git.exe'),
    under('ProgramFiles(x86)', 'Git', 'cmd', 'git.exe'),
    under('LOCALAPPDATA', 'Programs', 'Git', 'cmd', 'git.exe'),
  ])
}
