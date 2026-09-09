import { spawn } from 'node:child_process'
import type { Program } from '@shared/domain/catalog'
import { allStartMenuShortcuts, bestShortcutFor, findStartMenuShortcut } from './shortcuts'

export type LaunchResult = 'opened' | 'not-found' | 'failed'

const LAUNCH_TIMEOUT_MS = 10_000

function throughExplorer(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('explorer.exe', [path], { windowsHide: true, detached: true })

    const giveUp = setTimeout(() => {
      child.unref()
      resolve(true)
    }, LAUNCH_TIMEOUT_MS)

    const finish = (ok: boolean): void => {
      clearTimeout(giveUp)
      resolve(ok)
    }

    child.on('error', () => finish(false))
    child.on('close', () => finish(true))
  })
}

export async function openProgram(program: Program): Promise<LaunchResult> {
  const shortcut = await findStartMenuShortcut(program)
  if (!shortcut) return 'not-found'

  const ok = await throughExplorer(shortcut).catch(() => false)
  return ok ? 'opened' : 'failed'
}

export async function openableIds(programs: readonly Program[]): Promise<string[]> {
  const links = await allStartMenuShortcuts()
  return programs.filter((program) => bestShortcutFor(links, program) !== null).map((p) => p.id)
}
