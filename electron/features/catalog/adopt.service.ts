import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getPrograms } from '@shared/domain/catalog'
import { readWingetId, suggestedEntry } from '@shared/domain/inventory'
import { addToCatalog } from './remote.service'
import { forgetInventory } from './inventory.service'

const exec = promisify(execFile)

const CALL_TIMEOUT_MS = 30_000

export interface AdoptInput {
  name: string
  version?: string
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

/**
 * Adota um programa que está no PC e não está no catálogo. Sem identificador
 * do winget não adianta adotar: o item apareceria na lista e não teria como
 * ser instalado em PC nenhum.
 */
export async function adoptProgram(input: AdoptInput): Promise<AdoptResult> {
  const name = input.name.trim()
  if (!name) return { status: 'failed' }

  const wingetId = readWingetId(await askWinget(name))
  if (!wingetId) return { status: 'not-found' }

  const taken = getPrograms().map((program) => program.id)
  const entry = suggestedEntry({ name, wingetId }, taken)

  const program = { ...entry, ...(input.version ? { version: input.version } : {}) }

  try {
    const status = await addToCatalog(program)
    if (status === 'added') forgetInventory()
    return { status, id: program.id }
  } catch {
    return { status: 'failed' }
  }
}
