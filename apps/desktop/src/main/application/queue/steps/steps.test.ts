import { describe, expect, it, vi } from 'vitest'
import { PROGRAM_BY_ID, type Program } from '@pulse/catalog-data'
import type { Settings } from '@pulse/domain'
import { runSteps, STEP_IDS } from './index'
import type { StepContext, StepPorts } from './context'

function fakePorts(overrides: Partial<StepPorts> = {}): StepPorts {
  return {
    processRunner: {
      runOnce: async () => ({ code: 0, text: '' }),
      runWinget: async () => ({ code: 0, text: '' }),
      killWinget: () => {},
      run: async () => true,
      launchDetached: async () => {},
      runCommandLine: async () => true,
      openUri: async () => true,
      runElevated: async () => ({ code: 0, text: '' }),
      runAsInteractiveUser: async () => ({ code: 0, text: '' }),
      isElevated: async () => false,
      locateVsCode: async () => 'code.cmd',
      locateGit: async () => 'git.exe',
      forgetPathCache: () => {},
    },
    packageInstaller: {
      install: async () => ({ kind: 'ok', needsReboot: false }),
      installElevated: async () => ({ kind: 'ok', needsReboot: false }),
      uninstall: async () => ({ kind: 'ok' }),
      cancel: () => {},
    },
    autostartRegistry: { setAutostart: async () => 'on' },
    steamGameRequester: {
      isSignedIn: async () => true,
      hasManifest: async () => true,
      isInstallDialogOpen: async () => false,
    },
    ...overrides,
  }
}

interface Spy {
  ctx: StepContext
  details: string[]
  notes: string[]
}

function fakeContext(ports: StepPorts, program: Program): Spy {
  const details: string[] = []
  const notes: string[] = []

  return {
    details,
    notes,
    ctx: {
      itemId: program.id,
      program,
      drive: 'C:',
      ports,
      say: (detail) => details.push(detail),
      waitFor: (detail) => details.push(`[esperando] ${detail}`),
      progress: () => {},
      note: (text) => notes.push(text),
      canceled: () => false,
    },
  }
}

const vscode = PROGRAM_BY_ID.get('vscode') as Program

describe('runSteps', () => {
  it('não roda nada quando o ajuste não foi pedido', async () => {
    const ports = fakePorts()
    const run = vi.spyOn(ports.processRunner, 'run')
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps({}, ctx)

    expect(run).not.toHaveBeenCalled()
    expect(result).toEqual({})
  })

  it('instala as extensões pedidas e conta quantas entraram', async () => {
    const ports = fakePorts()
    const run = vi.spyOn(ports.processRunner, 'run')
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps({ extensions: ['a', 'b'] }, ctx)

    expect(result.extensions).toBe(2)
    expect(result.extensionsRequested).toBe(2)
    expect(run).toHaveBeenCalledWith('code.cmd', ['--install-extension', 'a', '--force'])
  })

  it('sem o VS Code no PATH, avisa e não conta extensão alguma', async () => {
    const ports = fakePorts()
    ports.processRunner.locateVsCode = async () => null
    const { ctx, notes } = fakeContext(ports, vscode)

    const result = await runSteps({ extensions: ['a'] }, ctx)

    expect(result.extensions).toBe(0)
    expect(result.extensionsRequested).toBe(1)
    expect(notes.join(' ')).toContain('não encontrei o comando do VS Code')
  })

  it('uma extensão que falha não derruba as outras', async () => {
    const ports = fakePorts()
    ports.processRunner.run = async (_exe, args) => args[1] !== 'ruim'
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps({ extensions: ['boa', 'ruim', 'outra'] }, ctx)

    expect(result.extensions).toBe(2)
    expect(result.extensionsRequested).toBe(3)
  })

  it('grava o git e separa o login do resto', async () => {
    const ports = fakePorts()
    const run = vi.spyOn(ports.processRunner, 'run')
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps(
      { git: { name: 'Wesley', email: 'w@x.com', branch: 'main', saveLogin: true } },
      ctx,
    )

    expect(result.git).toBe(true)
    expect(result.gitLogin).toBe(true)
    expect(run).toHaveBeenCalledWith('git.exe', ['config', '--global', 'user.name', 'Wesley'])
    expect(run).toHaveBeenCalledWith('git.exe', [
      'config',
      '--global',
      'credential.helper',
      'manager',
    ])
  })

  it('autostart devolve o efeito que o registro relatou', async () => {
    const ports = fakePorts()
    ports.autostartRegistry.setAutostart = async () => 'no-entry'
    const { ctx, notes } = fakeContext(ports, vscode)

    const result = await runSteps({ autostart: true }, ctx)

    expect(result.autostart).toBe('no-entry')
    expect(notes.join(' ')).toContain('não se cadastra')
  })

  it('autostart false ainda roda, porque desligar é um pedido', async () => {
    const ports = fakePorts()
    const set = vi.spyOn(ports.autostartRegistry, 'setAutostart')
    const { ctx } = fakeContext(ports, vscode)

    await runSteps({ autostart: false }, ctx)

    expect(set).toHaveBeenCalledWith(vscode, false)
  })

  // A espera da Steam é de quinze minutos de relógio real, então estes dois
  // rodam com o tempo adiantado na mão.
  it('sem conta da Steam conectada, os jogos ficam pendentes', async () => {
    vi.useFakeTimers()
    try {
      const ports = fakePorts()
      ports.steamGameRequester.isSignedIn = async () => false
      const { ctx } = fakeContext(ports, vscode)

      const running = runSteps({ games: [{ appid: '1', name: 'Dota' }] }, ctx)
      await vi.advanceTimersByTimeAsync(16 * 60_000)
      const result = await running

      expect(result.gamesPending).toEqual(['Dota'])
      expect(result.gamesAccepted).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('com o manifesto presente, o jogo conta como aceito', async () => {
    vi.useFakeTimers()
    try {
      const ports = fakePorts()
      const { ctx } = fakeContext(ports, vscode)

      const running = runSteps({ games: [{ appid: '1', name: 'Dota' }] }, ctx)
      await vi.advanceTimersByTimeAsync(5_000)
      const result = await running

      expect(result.gamesAccepted).toEqual(['Dota'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('junta o resultado de vários ajustes numa coisa só', async () => {
    const ports = fakePorts()
    const { ctx } = fakeContext(ports, vscode)

    const settings: Settings = {
      extensions: ['a'],
      git: { name: 'W', email: '', branch: 'main' },
      autostart: true,
    }
    const result = await runSteps(settings, ctx)

    expect(result.extensions).toBe(1)
    expect(result.git).toBe(true)
    expect(result.autostart).toBe('on')
  })

  it('a ordem declarada é a que a pessoa vê acontecer', () => {
    expect(STEP_IDS).toEqual([
      'vscodeExtensions',
      'gitConfig',
      'autostart',
      'steamGames',
      'tibiaPages',
      'riotProducts',
    ])
  })
})
