import { BrowserWindow } from 'electron'
import { register } from '../../ipc/register'
import { getProgram, getPrograms } from '@shared/domain/catalog'
import { alertFrom } from '../alerts'
import { openableIds, openProgram, type LaunchResult } from './launch'
import { readHistory } from './history.service'
import {
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

function listOpenable(): Promise<string[]> {
  return openableIds(getPrograms())
}

export function registerInstallation(): void {
  register('installation:start', (input) => start(input.requests, input.drive))
  register('installation:append', (input) => append(input.requests))
  register('installation:state', () => currentState())
  register('installation:cancel', () => cancel())
  register('installation:cancelItem', (input) => cancelItem(input.id))
  register('installation:retry', (input) => retry(input.id))
  register('installation:open', (input) => openById(input.id))
  register('installation:openable', () => listOpenable())
  register('installation:grant', (input) => grantPermission(input.id))
  register('installation:uninstall', (input) => uninstall(input.id))
  register('history:read', () => readHistory())

  subscribe((run) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('installation:event', run)
    }
    alertFrom(run)
  })
}
