import { describe, expect, it, vi } from 'vitest'
import type { Program } from '@shared/domain/catalog'
import type { Settings } from '@shared/domain/settings'
import type { StepContext } from './context'

const fired: string[] = []

function recorder(id: string) {
  return {
    [id]: async (value: unknown) => {
      fired.push(id)
      return { detail: value }
    },
  }
}

vi.mock('./vscodeExtensions', () => recorder('vscodeExtensions'))
vi.mock('./runtimePackages', () => recorder('runtimePackages'))
vi.mock('./editorTweaks', () => recorder('editorTweaks'))
vi.mock('./gitConfig', () => recorder('gitConfig'))
vi.mock('./desktopShortcut', () => recorder('desktopShortcut'))
vi.mock('./autostart', () => ({
  autostart: async () => {
    fired.push('autostart')
    return {}
  },
  setAutostart: async () => 'no-entry',
}))
vi.mock('./steamGames', () => recorder('steamGames'))
vi.mock('./tibiaPages', () => recorder('tibiaPages'))
vi.mock('./riotProducts', () => recorder('riotProducts'))

const { runSteps, STEP_IDS } = await import('./index')

const program = { id: 'vscode', name: 'VS Code', hints: [] } as unknown as Program

function contextFor(settings: Settings): StepContext {
  return {
    program,
    drive: 'C:',
    settings,
    say: () => {},
    waitFor: () => {},
    note: () => {},
    progress: () => {},
    merge: () => {},
    runWinget: async () => ({ code: 0, text: '' }),
  }
}

async function run(settings: Settings): Promise<string[]> {
  fired.length = 0
  await runSteps(contextFor(settings))
  return [...fired]
}

describe('runSteps', () => {
  it('mantém a ordem em que os ajustes sempre foram aplicados', async () => {
    expect(STEP_IDS).toEqual([
      'vscodeExtensions',
      'runtimePackages',
      'editorTweaks',
      'gitConfig',
      'desktopShortcut',
      'autostart',
      'steamGames',
      'tibiaPages',
      'riotProducts',
    ])
  })

  it('não roda nada quando não há ajuste escolhido', async () => {
    expect(await run({})).toEqual([])
  })

  it('roda só o que foi escolhido', async () => {
    const settings = { steps: { editorTweaks: ['tema'] } } as unknown as Settings
    expect(await run(settings)).toEqual(['editorTweaks'])
  })

  it('respeita a ordem mesmo quando tudo foi escolhido', async () => {
    const settings = {
      desktopShortcut: true,
      autostart: false,
      steps: {
        riotProducts: ['lol'],
        tibiaPages: ['tibia'],
        steamGames: [],
        gitConfig: { email: 'eu@exemplo.com' },
        editorTweaks: ['tema'],
        runtimePackages: ['typescript'],
        vscodeExtensions: ['dracula'],
      },
    } as unknown as Settings

    expect(await run(settings)).toEqual(STEP_IDS)
  })

  it('trata desligar o atalho como escolha, não como ausência', async () => {
    const settings = { desktopShortcut: false } as unknown as Settings
    expect(await run(settings)).toEqual(['desktopShortcut'])
  })

  it('junta o que cada ajuste devolveu', async () => {
    const settings = { steps: { tibiaPages: ['tibia'] } } as unknown as Settings
    const found = await runSteps(contextFor(settings))
    expect(found).toEqual({ detail: ['tibia'] })
  })
})
