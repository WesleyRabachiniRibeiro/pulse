import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Program } from '@shared/domain/catalog'
import { PARALLEL_LIMIT, type Request, type Run } from '@shared/domain/installation'

let userData = ''
const clipboardWrites: string[] = []
const catalogPrograms = new Map<string, Program>()
let installed = new Set<string>()
let quietUninstallers: string[] = []
const remembered: Run[] = []

type SpawnHandlers = Record<string, ((...args: never[]) => void)[]>

interface FakeChildProcess {
  pid: number
  stdout: { on(event: string, fn: (data: Buffer) => void): void }
  stderr: { on(event: string, fn: (data: Buffer) => void): void }
  on(event: string, fn: (...args: never[]) => void): void
}

interface WingetTurn {
  code: number
  text?: string
  lines?: string[]
}

let wingetScript: WingetTurn[] = []
const wingetCalls: string[][] = []
const killed: number[] = []

function nextWingetTurn(): WingetTurn {
  return wingetScript.shift() ?? { code: 0 }
}

vi.mock('electron', () => ({
  app: { getPath: (): string => userData },
  clipboard: { writeText: (text: string): void => void clipboardWrites.push(text) },
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, mkdir: (): Promise<void> => Promise.resolve() }
})

vi.mock('node:child_process', () => ({
  spawn: (exe: string, args: readonly string[]): FakeChildProcess => {
    if (exe === 'taskkill') {
      const pid = Number(args[args.indexOf('/pid') + 1])
      killed.push(pid)
      return {
        pid: 0,
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: () => {},
      }
    }

    wingetCalls.push([exe, ...args])
    const turn = nextWingetTurn()
    const stdoutHandlers: SpawnHandlers = {}
    const stderrHandlers: SpawnHandlers = {}
    const childHandlers: SpawnHandlers = {}

    queueMicrotask(() => {
      for (const line of turn.lines ?? []) {
        for (const fn of stdoutHandlers['data'] ?? []) fn(Buffer.from(`${line}\n`) as never)
      }
      if (turn.text) for (const fn of stderrHandlers['data'] ?? []) fn(Buffer.from(turn.text) as never)
      for (const fn of childHandlers['close'] ?? []) fn(turn.code as never)
    })

    return {
      pid: 4242,
      stdout: { on: (event, fn) => void (stdoutHandlers[event] ??= []).push(fn) },
      stderr: { on: (event, fn) => void (stderrHandlers[event] ??= []).push(fn) },
      on: (event, fn) => void (childHandlers[event] ??= []).push(fn),
    }
  },
}))

vi.mock('@shared/domain/catalog', () => ({
  getProgram: (id: string): Program | undefined => catalogPrograms.get(id),
}))

vi.mock('../catalog', () => ({
  forgetCatalog: (): void => {},
  isInstalled: (id: string): Promise<boolean> => Promise.resolve(installed.has(id)),
  quietUninstallCommands: (): Promise<string[]> => Promise.resolve(quietUninstallers),
}))

vi.mock('../browsers', () => ({
  makeDefault: (): Promise<'yes' | 'asked' | 'failed'> => Promise.resolve('yes'),
  openOnce: (): Promise<{ result: 'opened' }> => Promise.resolve({ result: 'opened' }),
}))

vi.mock('../preflight', () => ({
  listDrives: (): Promise<never[]> => Promise.resolve([]),
}))

vi.mock('../toolchain', () => ({
  forgetPath: (): void => {},
  runCommandLine: (): Promise<boolean> => Promise.resolve(true),
}))

vi.mock('./steps', () => ({
  runSteps: (): Promise<Record<string, never>> => Promise.resolve({}),
}))

let elevatedFlag = false
let interactiveOutput = { code: 0, text: '' }

vi.mock('./infrastructure/asUser', () => ({
  isElevated: (): Promise<boolean> => Promise.resolve(elevatedFlag),
  runAsInteractiveUser: (): Promise<{ code: number; text: string }> =>
    Promise.resolve(interactiveOutput),
  runnerFailure: (code: number): string | null =>
    code === -1007 ? 'o comando passou do tempo e não terminou' : null,
}))

vi.mock('./infrastructure/asAdmin', () => ({
  REFUSED_BY_USER: 1223,
  adminFailure: (): string | null => null,
  runAsAdmin: (): Promise<{ code: number; text: string }> => Promise.resolve({ code: 0, text: '' }),
}))

vi.mock('./history.service', () => ({
  rememberRun: (run: Run): void => void remembered.push(run),
}))

vi.mock('../parental', () => ({
  isGranted: (): boolean => true,
  readParental: (): Promise<null> => Promise.resolve(null),
}))

const service = await import('./installation.service')

function program(id: string, extra: Partial<Program> = {}): Program {
  const p: Program = {
    id,
    name: id,
    winget: `pkg.${id}`,
    version: '1',
    mb: 100,
    category: 'dev',
    hints: [id],
    ...extra,
  }
  catalogPrograms.set(id, p)
  return p
}

function request(id: string, drive = 'C:', extra: Partial<Request> = {}): Request {
  return { id, drive, ...extra }
}

function itemOf(run: Run | null, id: string) {
  const found = run?.items.find((i) => i.id === id)
  if (!found) throw new Error(`item ${id} not found`)
  return found
}

async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve()
}

beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'pulse-install-'))
  process.env['SystemDrive'] = 'C:'
  catalogPrograms.clear()
  installed = new Set()
  quietUninstallers = []
  clipboardWrites.length = 0
  wingetCalls.length = 0
  killed.length = 0
  remembered.length = 0
  wingetScript = []
  elevatedFlag = false
  interactiveOutput = { code: 0, text: '' }
})

afterEach(async () => {
  await rm(userData, { recursive: true, force: true })
})

describe('start', () => {
  it('installs successfully on the first try', async () => {
    program('vim')
    wingetScript = [{ code: 0 }]

    const run = service.start([request('vim')], 'C:')
    expect(itemOf(run, 'vim').status).toBe('downloading')

    await settle()

    const finished = service.currentState()
    expect(itemOf(finished, 'vim').status).toBe('done')
    expect(itemOf(finished, 'vim').detail).toBe('Pronto para usar')
    expect(wingetCalls).toHaveLength(1)
    expect(wingetCalls[0]).toContain('install')
  })

  it('does not call winget for a pages-source program', async () => {
    program('tibia', { source: 'pages', winget: undefined })

    service.start([request('tibia')], 'C:')
    await settle()

    const finished = service.currentState()
    expect(itemOf(finished, 'tibia').status).toBe('done')
    expect(wingetCalls).toHaveLength(0)
  })

  it('treats an already-installed exit code as success without a reboot flag', async () => {
    program('git')
    wingetScript = [{ code: 0x8a15002b }]

    service.start([request('git')], 'C:')
    await settle()

    const finished = itemOf(service.currentState(), 'git')
    expect(finished.status).toBe('done')
    expect(finished.detail).toBe('Já estava instalado')
    expect(finished.needsRestart).toBeUndefined()
  })

  it('flags needsRestart when a successful run reports a restart is required', async () => {
    program('vlc')
    wingetScript = [{ code: 0, text: 'restart required to finish' }]

    service.start([request('vlc')], 'C:')
    await settle()

    const finished = itemOf(service.currentState(), 'vlc')
    expect(finished.status).toBe('done')
    expect(finished.needsRestart).toBe(true)
    expect(finished.detail).toBe('Instalado, falta reiniciar o PC')
  })

  it('fails on a bare reboot-required exit code with no matching output text', async () => {
    program('7zip')
    wingetScript = [{ code: 3010 }]

    service.start([request('7zip')], 'C:')
    await settle()

    const finished = itemOf(service.currentState(), '7zip')
    expect(finished.status).toBe('failed')
  })

  it('retries without the destination when winget refuses the chosen drive', async () => {
    program('steam')
    wingetScript = [{ code: 1, text: 'invalid location' }, { code: 0 }]

    service.start([request('steam', 'D:')], 'C:')
    await settle()

    const finished = itemOf(service.currentState(), 'steam')
    expect(finished.status).toBe('done')
    expect(finished.driveIgnored).toBe(true)
    expect(wingetCalls).toHaveLength(2)
    expect(wingetCalls[0]?.some((a) => a.includes('--location'))).toBe(true)
    expect(wingetCalls[1]?.some((a) => a.includes('--location'))).toBe(false)
  })

  it('retries without scope when no package exists for the requested scope', async () => {
    program('docker')
    wingetScript = [{ code: 1, text: 'no applicable installer found' }, { code: 0 }]

    service.start([request('docker', 'C:', { settings: { scope: 'machine' } })], 'C:')
    await settle()

    const finished = itemOf(service.currentState(), 'docker')
    expect(finished.status).toBe('done')
    expect(finished.scopeIgnored).toBe(true)
    expect(wingetCalls[0]?.some((a) => a === '--scope')).toBe(true)
    expect(wingetCalls[1]?.some((a) => a === '--scope')).toBe(false)
  })

  it('retries without locale when the program does not ship in the requested language', async () => {
    program('vscode')
    wingetScript = [{ code: 1, text: 'no applicable installer found' }, { code: 0 }]

    service.start([request('vscode', 'C:', { settings: { locale: 'pt-BR' } })], 'C:')
    await settle()

    const finished = itemOf(service.currentState(), 'vscode')
    expect(finished.status).toBe('done')
    expect(finished.localeIgnored).toBe(true)
    expect(wingetCalls[0]?.some((a) => a === '--locale')).toBe(true)
    expect(wingetCalls[1]?.some((a) => a === '--locale')).toBe(false)
  })

  it('retries after a Windows Installer busy failure', async () => {
    vi.useFakeTimers()
    try {
      program('office')
      wingetScript = [{ code: 1618 }, { code: 0 }]

      service.start([request('office')], 'C:')
      await vi.advanceTimersByTimeAsync(6000)
      await settle()

      const finished = itemOf(service.currentState(), 'office')
      expect(finished.status).toBe('done')
      expect(wingetCalls).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives up after exhausting the Windows Installer busy retries', async () => {
    vi.useFakeTimers()
    try {
      program('office')
      wingetScript = [{ code: 1618 }, { code: 1618 }, { code: 1618 }]

      service.start([request('office')], 'C:')
      await vi.advanceTimersByTimeAsync(6000)
      await vi.advanceTimersByTimeAsync(6000)
      await settle()

      const finished = itemOf(service.currentState(), 'office')
      expect(finished.status).toBe('failed')
      expect(wingetCalls).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('asks for admin permission and proceeds once granted', async () => {
    program('word')
    wingetScript = [{ code: 5 }]

    service.start([request('word')], 'C:')
    await settle()

    const waiting = itemOf(service.currentState(), 'word')
    expect(waiting.status).toBe('waiting')
    expect(waiting.needsPermission).toBe(true)

    service.grantPermission('word')
    await settle()

    const finished = itemOf(service.currentState(), 'word')
    expect(finished.status).toBe('done')
    expect(wingetCalls).toHaveLength(1)
  })

  it('cancels a single active item that is waiting for admin permission', async () => {
    program('excel')
    wingetScript = [{ code: 5 }]

    service.start([request('excel')], 'C:')
    await settle()
    expect(itemOf(service.currentState(), 'excel').status).toBe('waiting')

    service.cancelItem('excel')
    await settle()

    const finished = itemOf(service.currentState(), 'excel')
    expect(finished.status).toBe('canceled')
  })

  it('cancels a queued item before it starts', () => {
    for (const id of ['a', 'b', 'c', 'd']) program(id)
    wingetScript = [{ code: 0 }, { code: 0 }, { code: 0 }, { code: 0 }]

    const run = service.start(['a', 'b', 'c', 'd'].map((id) => request(id)), 'C:')
    const queuedId = run.items.find((i) => i.status === 'queued')?.id
    expect(queuedId).toBeDefined()

    service.cancelItem(queuedId ?? '')
    const after = itemOf(service.currentState(), queuedId ?? '')
    expect(after.status).toBe('canceled')
    expect(after.detail).toBe('Cancelado antes de começar')
  })

  it('limits concurrent installs to PARALLEL_LIMIT and drains the rest afterwards', async () => {
    for (const id of ['a', 'b', 'c', 'd']) program(id)
    wingetScript = [{ code: 0 }, { code: 0 }, { code: 0 }, { code: 0 }]

    const run = service.start(['a', 'b', 'c', 'd'].map((id) => request(id)), 'C:')
    const statuses = ['a', 'b', 'c', 'd'].map((id) => itemOf(run, id).status)
    expect(statuses.filter((s) => s === 'downloading')).toHaveLength(PARALLEL_LIMIT)
    expect(statuses.filter((s) => s === 'queued')).toHaveLength(4 - PARALLEL_LIMIT)

    await settle()

    const finished = service.currentState()
    for (const id of ['a', 'b', 'c', 'd']) expect(itemOf(finished, id).status).toBe('done')
  })

  it('cancels the whole queue and kills the running installer process', async () => {
    program('firefox')
    wingetScript = [{ code: 0 }]

    service.start([request('firefox')], 'C:')
    for (let tries = 0; wingetCalls.length === 0 && tries < 20; tries++) await Promise.resolve()
    service.cancel()

    expect(killed).toContain(4242)
  })

  it('re-queues a failed item on retry', async () => {
    program('slack')
    wingetScript = [{ code: 1, text: 'boom' }]

    service.start([request('slack')], 'C:')
    await settle()
    expect(itemOf(service.currentState(), 'slack').status).toBe('failed')

    wingetScript = [{ code: 0 }]
    service.retry('slack')
    await settle()

    expect(itemOf(service.currentState(), 'slack').status).toBe('done')
  })
})

describe('uninstall', () => {
  it('reports success and verified when the program disappears right away', async () => {
    program('paint-net')
    installed = new Set()
    wingetScript = [{ code: 0 }]

    const result = await service.uninstall('paint-net')
    expect(result).toEqual({ ok: true, verified: true })
  })

  it('reports success but unverified when the program still appears installed', async () => {
    vi.useFakeTimers()
    try {
      program('paint-net')
      installed = new Set(['paint-net'])
      wingetScript = [{ code: 0 }]

      const pending = service.uninstall('paint-net')
      await vi.advanceTimersByTimeAsync(30_000)
      const result = await pending

      expect(result.ok).toBe(true)
      expect(result.verified).toBe(false)
      expect(result.error).toContain('ainda aparece instalado')
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to the program\'s own uninstaller when winget fails but it later disappears', async () => {
    vi.useFakeTimers()
    try {
      program('legacy-app')
      installed = new Set(['legacy-app'])
      quietUninstallers = ['C:\\legacy\\uninstall.exe /S']
      wingetScript = [{ code: 1, text: 'winget deu erro' }]

      const pending = service.uninstall('legacy-app')
      await vi.advanceTimersByTimeAsync(10_000)
      installed.delete('legacy-app')
      await vi.advanceTimersByTimeAsync(30_000)
      const result = await pending

      expect(result).toEqual({ ok: true, verified: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports the program was never installed by winget when no uninstaller exists', async () => {
    vi.useFakeTimers()
    try {
      program('portable-app')
      installed = new Set(['portable-app'])
      quietUninstallers = []
      wingetScript = [{ code: 1, text: 'no installed package found for the given criteria' }]

      const pending = service.uninstall('portable-app')
      await vi.advanceTimersByTimeAsync(30_000)
      const result = await pending

      expect(result.ok).toBe(false)
      expect(result.verified).toBe(false)
      expect(result.error).toContain('não consegue removê-lo sozinho')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a program not in the catalog', async () => {
    const result = await service.uninstall('unknown-program')
    expect(result).toEqual({ ok: false, verified: false, error: 'Programa fora do catálogo.' })
  })

  it('refuses to uninstall a program the Pulse never installed via winget', async () => {
    program('manual-app', { winget: undefined })
    const result = await service.uninstall('manual-app')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('não instalou')
  })

  it('reports failure when the interactive-user runner cannot start the process', async () => {
    program('teams')
    elevatedFlag = true
    interactiveOutput = { code: -1007, text: '' }

    const result = await service.uninstall('teams')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('não conseguiu remover')
  })
})
