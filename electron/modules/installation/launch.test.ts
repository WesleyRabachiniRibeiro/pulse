import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Program } from '@shared/domain/catalog'

let home = ''
const launched: string[] = []
let launchFails = false

vi.mock('electron', () => ({
  app: { getPath: (): string => join(home, 'Desktop') },
}))

vi.mock('node:child_process', () => ({
  spawn: (exe: string, args: readonly string[]) => {
    const handlers: Record<string, (() => void)[]> = {}
    queueMicrotask(() => {
      if (launchFails) for (const fn of handlers['error'] ?? []) fn()
      else {
        launched.push(`${exe} ${args.join(' ')}`)
        for (const fn of handlers['close'] ?? []) fn()
      }
    })
    return {
      on(event: string, fn: () => void) {
        ;(handlers[event] ??= []).push(fn)
        return this
      },
      unref() {},
    }
  },
}))

const { openableIds, openProgram } = await import('./launch')

function program(id: string, name: string, hints: string[]): Program {
  return { id, name, winget: `x.${id}`, version: '1', mb: 1, category: 'dev', hints }
}

const chrome = program('chrome', 'Google Chrome', ['google chrome'])
const kubectl = program('kubectl', 'kubectl', ['kubectl'])

function startMenu(): string {
  return join(home, 'AppData', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
}

async function putShortcut(name: string): Promise<void> {
  await mkdir(startMenu(), { recursive: true })
  await writeFile(join(startMenu(), name), 'atalho de mentira', 'utf8')
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'pulse-launch-'))
  launched.length = 0
  launchFails = false
  process.env['APPDATA'] = join(home, 'AppData')
  process.env['ProgramData'] = join(home, 'ProgramData')
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('openProgram', () => {
  it('abre pelo atalho do menu Iniciar', async () => {
    await putShortcut('Google Chrome.lnk')

    await expect(openProgram(chrome)).resolves.toBe('opened')
    expect(launched[0]).toContain('Google Chrome.lnk')
  })

  it('abre pelo explorer, que é quem devolve o processo ao usuário', async () => {
    await putShortcut('Google Chrome.lnk')

    await openProgram(chrome)
    expect(launched[0]?.startsWith('explorer.exe ')).toBe(true)
  })

  it('avisa quando o programa não tem atalho', async () => {
    await putShortcut('Google Chrome.lnk')

    await expect(openProgram(kubectl)).resolves.toBe('not-found')
    expect(launched).toEqual([])
  })

  it('avisa quando o explorer recusa', async () => {
    await putShortcut('Google Chrome.lnk')
    launchFails = true

    await expect(openProgram(chrome)).resolves.toBe('failed')
  })

  it('escolhe o atalho mais próximo quando há mais de um', async () => {
    await putShortcut('Google Chrome Beta.lnk')
    await putShortcut('Google Chrome.lnk')

    await openProgram(chrome)
    expect(launched[0]).toContain('Google Chrome.lnk')
    expect(launched[0]).not.toContain('Beta')
  })
})

describe('openableIds', () => {
  it('devolve só quem tem atalho, varrendo o menu uma vez', async () => {
    await putShortcut('Google Chrome.lnk')

    await expect(openableIds([chrome, kubectl])).resolves.toEqual(['chrome'])
  })

  it('devolve vazio quando o menu Iniciar está vazio', async () => {
    await expect(openableIds([chrome, kubectl])).resolves.toEqual([])
  })

  it('mantém a ordem do catálogo', async () => {
    await putShortcut('Google Chrome.lnk')
    await putShortcut('kubectl.lnk')

    await expect(openableIds([kubectl, chrome])).resolves.toEqual(['kubectl', 'chrome'])
  })
})
