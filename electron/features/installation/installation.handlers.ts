import { BrowserWindow } from 'electron'
import { register } from '../../ipc/register'
import { getProgram, getPrograms } from '@shared/domain/catalog'
import { alertFrom } from '../alerts'
import { isGranted, readParental } from '../preferences/parental.service'
import { blockedAmong } from '@shared/domain/parental'
import type { Request } from '@shared/domain/installation'
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

/** Tudo bloqueado quer dizer fila nenhuma, e a tela precisa saber por quê. */
async function pass(requests: readonly Request[]): Promise<Request[]> {
  const free = await allowed(requests)
  if (free.length === 0 && requests.length > 0) {
    throw new Error(
      requests.length === 1
        ? 'Este programa está bloqueado pelo controle dos pais.'
        : 'Todos os programas escolhidos estão bloqueados pelo controle dos pais.',
    )
  }
  return free
}

function listOpenable(): Promise<string[]> {
  return openableIds(getPrograms())
}

export function registerInstallation(): void {
  register('installation:start', async (input) => start(await pass(input.requests), input.drive))
  register('installation:append', async (input) => append(await pass(input.requests)))
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
      throw new Error('Com o controle dos pais ligado, tirar programa do PC pede o PIN.')
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
