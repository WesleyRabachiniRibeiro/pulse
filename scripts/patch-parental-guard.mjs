import { readFileSync, writeFileSync } from 'node:fs'

const TICK = String.fromCharCode(96)
const D = '$'

function edit(path, pairs) {
  let text = readFileSync(path, 'utf8')
  for (const [from, to] of pairs) {
    if (!text.includes(from)) throw new Error(`não achei em ${path}: ${from.slice(0, 70)}`)
    text = text.replace(from, to)
  }
  writeFileSync(path, text)
}

const noteLine =
  '    note(' + TICK + D + '{getProgram(id)?.name ?? id}: bloqueado pelo controle dos pais' + TICK + ", 'error')"

const guard = [
  '/**',
  ' * Programa bloqueado não entra na fila, venha ele de onde vier: da seleção, de',
  ' * um combo, de um perfil importado ou do botão de atualizar.',
  ' */',
  'export async function allowed(requests: readonly Request[]): Promise<Request[]> {',
  '  const parental = await readParental().catch(() => null)',
  '  if (!parental) return [...requests]',
  '',
  '  const wall = new Set(blockedAmong(parental, requests.map((one) => one.id)))',
  '  if (wall.size === 0) return [...requests]',
  '',
  '  for (const id of wall) {',
  noteLine,
  '  }',
  '',
  '  return requests.filter((one) => !wall.has(one.id))',
  '}',
  '',
  'export function start(requests: readonly Request[], drive: string): Run {',
].join('\n')

edit('electron/features/installation/installation.service.ts', [
  [
    `import { rememberRun } from './history.service'`,
    `import { rememberRun } from './history.service'
import { readParental } from '../preferences/parental.service'
import { blockedAmong } from '@shared/domain/parental'`,
  ],
  [`export function start(requests: readonly Request[], drive: string): Run {`, guard],
])

edit('electron/features/installation/installation.handlers.ts', [
  [
    `import { alertFrom } from '../alerts'`,
    `import { alertFrom } from '../alerts'
import { readParental } from '../preferences/parental.service'
import { blockedAmong } from '@shared/domain/parental'`,
  ],
  [
    `import {
  append,
  cancel,`,
    `import {
  allowed,
  append,
  cancel,`,
  ],
  [
    `  register('installation:start', (input) => start(input.requests, input.drive))
  register('installation:append', (input) => append(input.requests))`,
    `  register('installation:start', async (input) => {
    const pass = await allowed(input.requests)
    return pass.length > 0 ? start(pass, input.drive) : currentState()
  })
  register('installation:append', async (input) => append(await allowed(input.requests)))`,
  ],
  [
    `  register('installation:uninstall', (input) => uninstall(input.id))`,
    `  register('installation:uninstall', (input) => uninstall(input.id))
  register('installation:mayInstall', async (input) => {
    const parental = await readParental().catch(() => null)
    return parental ? blockedAmong(parental, [input.id]).length === 0 : true
  })`,
  ],
])

edit('shared/ipc/contracts.ts', [
  [
    `  'installation:uninstall': {`,
    `  'installation:mayInstall': {
    input: idInputSchema,
    output: z.boolean(),
  },
  'installation:uninstall': {`,
  ],
])

console.log('ok')
