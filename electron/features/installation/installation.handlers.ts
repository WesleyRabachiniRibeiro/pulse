import { BrowserWindow } from 'electron'
import { register } from '../../ipc/register'
import { getProgram, getPrograms } from '@shared/domain/catalog'
import { alertFrom } from '../alerts'
import { isGranted, readParental } from '../parental'
import { blockedAmong } from '@shared/domain/parental'
import type { Request } from '@shared/domain/installation'
import type { Refusal } from '@shared/features/installation/contracts'
import { openableIds, openProgram, type LaunchResult } from './launch'
import { readHistory } from './history.service'
import {
  allowed,
  append,
  cancel,
  cancelItem,
  currentState,
  grantPermission,
  retry,
  start,
  subscribe,
  uninstall,
} from './installation.service'

async function openById(id: string): Promise<LaunchResult> {
  const program = getProgram(id)
  return program ? openProgram(program) : 'not-found'
}

async function pass(requests: readonly Request[]): Promise<Request[] | Refusal> {
  const free = await allowed(requests)
  if (free.length === 0 && requests.length > 0) {
    return requests.length === 1 ? 'one-blocked' : 'all-blocked'
  }
  return free
}

function listOpenable(): Promise<string[]> {
  return openableIds(getPrograms())
}

export function registerInstallation(): void {
  register('installation:start', async (input) => {
    const free = await pass(input.requests)
    if (!Array.isArray(free)) return { ok: false as const, refused: free }
    return { ok: true as const, run: start(free, input.drive) }
  })

  register('installation:append', async (input) => {
    const free = await pass(input.requests)
    if (!Array.isArray(free)) return { ok: false as const, refused: free }
    return { ok: true as const, run: append(free) }
  })

  register('installation:state', () => currentState())
  register('installation:cancel', () => cancel())
  register('installation:cancelItem', (input) => cancelItem(input.id))
  register('installation:retry', (input) => retry(input.id))
  register('installation:open', (input) => openById(input.id))
  register('installation:openable', () => listOpenable())
  register('installation:grant', (input) => grantPermission(input.id))
  register('installation:uninstall', async (input) => {
    const parental = await readParental().catch(() => null)
    const trancado = parental ? parental.on && Boolean(parental.secret) : false
    if (trancado && !isGranted(input.id)) {
      return { ok: false, verified: false, refused: 'needs-pin' as const }
    }
    return uninstall(input.id)
  })
  register('installation:mayInstall', async (input) => {
    const parental = await readParental().catch(() => null)
    if (!parental) return true
    return isGranted(input.id) || blockedAmong(parental, [input.id]).length === 0
  })
  register('history:read', () => readHistory())

  subscribe((run) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('installation:event', run)
    }
    alertFrom(run)
  })
}
