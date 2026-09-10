import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getPrograms } from '@shared/domain/catalog'
import { readWingetId, suggestedEntry } from '@shared/domain/inventory'
import { addToCatalog } from './remote.service'
import { forgetInventory } from './inventory.service'
import { readFileIcon } from '../system'

const exec = promisify(execFile)

const CALL_TIMEOUT_MS = 30_000

export interface AdoptInput {
  name: string
  version?: string
  icon?: string
}

export interface AdoptResult {
  status: 'added' | 'exists' | 'not-found' | 'failed'
  id?: string
}

async function askWinget(name: string): Promise<string> {
  const { stdout } = await exec(
    'winget',
    ['list', '--name', name, '--disable-interactivity', '--accept-source-agreements'],
    { windowsHide: true, timeout: CALL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  return stdout
}

export async function adoptProgram(input: AdoptInput): Promise<AdoptResult> {
  const name = input.name.trim()
  if (!name) return { status: 'failed' }

  const wingetId = readWingetId(await askWinget(name))
  if (!wingetId) return { status: 'not-found' }

  const taken = getPrograms().map((program) => program.id)
  const entry = suggestedEntry({ name, wingetId }, taken)

  const image = input.icon ? await readFileIcon(input.icon).catch(() => null) : null

  const program = {
    ...entry,
    ...(input.version ? { version: input.version } : {}),
    ...(image ? { icon: image } : {}),
  }

  try {
    const status = await addToCatalog(program)
    if (status === 'added') forgetInventory()
    return { status, id: program.id }
  } catch {
    return { status: 'failed' }
  }
}
