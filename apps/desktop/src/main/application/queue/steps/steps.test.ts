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
      },
    packageInstaller: {
      install: async () => ({ kind: 'ok', needsReboot: false }),
      installElevated: async () => ({ kind: 'ok', needsReboot: false }),
      uninstall: async () => ({ kind: 'ok' }),
      cancel: () => {},
    },
    autostartRegistry: { setAutostart: async () => 'on' },
    editorSettingsStore: { apply: async () => 'written' },
    toolchain: {
      locate: async (tool) => (tool === 'vscode' ? 'code.cmd' : 'git.exe'),
      run: async () => true,
      read: async () => '',
      forgetPath: () => {},
    },
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
    const run = vi.spyOn(ports.toolchain, 'run')
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps({}, ctx)

    expect(run).not.toHaveBeenCalled()
    expect(result).toEqual({})
  })

  it('instala as extensões pedidas e conta quantas entraram', async () => {
    const ports = fakePorts()
    const run = vi.spyOn(ports.toolchain, 'run')
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps({ steps: { vscodeExtensions: ['a', 'b'] } }, ctx)

    expect(result.extensions).toBe(2)
    expect(result.extensionsRequested).toBe(2)
    expect(run).toHaveBeenCalledWith('code.cmd', ['--install-extension', 'a', '--force'])
  })

  it('sem o VS Code no PATH, avisa e não conta extensão alguma', async () => {
    const ports = fakePorts()
    ports.toolchain.locate = async () => null
    const { ctx, notes } = fakeContext(ports, vscode)

    const result = await runSteps({ steps: { vscodeExtensions: ['a'] } }, ctx)

    expect(result.extensions).toBe(0)
    expect(result.extensionsRequested).toBe(1)
    expect(notes.join(' ')).toContain('não encontrei o comando do VS Code')
  })

  it('uma extensão que falha não derruba as outras', async () => {
    const ports = fakePorts()
    ports.toolchain.run = async (_exe: string, args: readonly string[]) => args[1] !== 'ruim'
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps({ steps: { vscodeExtensions: ['boa', 'ruim', 'outra'] } }, ctx)

    expect(result.extensions).toBe(2)
    expect(result.extensionsRequested).toBe(3)
  })

  it('grava o git e separa o login do resto', async () => {
    const ports = fakePorts()
    const run = vi.spyOn(ports.toolchain, 'run')
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps(
      { steps: { gitConfig: { name: 'Wesley', email: 'w@x.com', branch: 'main', saveLogin: true } } },
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

      const running = runSteps({ steps: { steamGames: [{ appid: '1', name: 'Dota' }] } }, ctx)
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

      const running = runSteps({ steps: { steamGames: [{ appid: '1', name: 'Dota' }] } }, ctx)
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
      steps: { vscodeExtensions: ['a'], gitConfig: { name: 'W', email: '', branch: 'main' } },
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
      'editorTweaks',
      'runtimePackages',
      'gitConfig',
      'autostart',
      'steamGames',
      'tibiaPages',
      'riotProducts',
    ])
  })
})

describe('ajustes do editor', () => {
  it('grava os marcados e relata que gravou', async () => {
    const ports = fakePorts()
    let seen: readonly string[] = []
    ports.editorSettingsStore.apply = async (_id, ids) => {
      seen = ids
      return 'written'
    }
    const { ctx, notes } = fakeContext(ports, vscode)

    const result = await runSteps({ steps: { editorTweaks: ['wordWrap', 'bigFont'] } }, ctx)

    expect(seen).toEqual(['wordWrap', 'bigFont'])
    expect(result.editor).toBe('written')
    expect(notes.join(' ')).toContain('2 ajustes gravados')
  })

  // O settings.json aceita comentário, que não é JSON. Nesse caso o arquivo
  // fica como está, e a pessoa precisa saber disso pelo resumo.
  it('arquivo ilegível não é sobrescrito, e o resumo diz', async () => {
    const ports = fakePorts()
    ports.editorSettingsStore.apply = async () => 'unreadable'
    const { ctx, notes } = fakeContext(ports, vscode)

    const result = await runSteps({ steps: { editorTweaks: ['wordWrap'] } }, ctx)

    expect(result.editor).toBe('unreadable')
    expect(notes.join(' ')).toContain('deixei como estava')
  })

  it('um erro na gravação vira falha, não exceção', async () => {
    const ports = fakePorts()
    ports.editorSettingsStore.apply = async () => {
      throw new Error('disco cheio')
    }
    const { ctx } = fakeContext(ports, vscode)

    const result = await runSteps({ steps: { editorTweaks: ['wordWrap'] } }, ctx)

    expect(result.editor).toBe('failed')
  })

  it('nada marcado não chama o disco', async () => {
    const ports = fakePorts()
    let called = false
    ports.editorSettingsStore.apply = async () => {
      called = true
      return 'written'
    }
    const { ctx } = fakeContext(ports, vscode)

    await runSteps({ steps: { editorTweaks: [] } }, ctx)

    expect(called).toBe(false)
  })
})

describe('ferramentas do runtime', () => {
  const node = PROGRAM_BY_ID.get('node') as Program

  // A ordem dos pacotes é a do catálogo do runtime, não a ordem em que a
  // pessoa marcou, para a linha de comando sair sempre igual.
  it('instala tudo numa chamada só, com os argumentos do npm', async () => {
    const ports = fakePorts()
    let seen: [string, readonly string[]] | null = null
    ports.toolchain.locate = async () => 'npm.cmd'
    ports.toolchain.run = async (exe: string, args: readonly string[]) => {
      seen = [exe, args]
      return true
    }
    const { ctx } = fakeContext(ports, node)

    const result = await runSteps({ steps: { runtimePackages: ['pnpm', 'typescript'] } }, ctx)

    expect(seen).toEqual(['npm.cmd', ['install', '--global', 'typescript', 'pnpm']])
    expect(result.packagesInstalled).toEqual(['typescript', 'pnpm'])
  })

  // Um id que não é do catálogo daquele runtime não pode virar argumento de
  // linha de comando.
  it('ignora pacote que não é do runtime escolhido', async () => {
    const ports = fakePorts()
    let seen: readonly string[] = []
    ports.toolchain.locate = async () => 'npm.cmd'
    ports.toolchain.run = async (_exe: string, args: readonly string[]) => {
      seen = args
      return true
    }
    const { ctx } = fakeContext(ports, node)

    await runSteps({ steps: { runtimePackages: ['pnpm', 'ruff', 'inventado'] } }, ctx)

    expect(seen).toEqual(['install', '--global', 'pnpm'])
  })

  it('sem o gerenciador no PATH, fica para depois e o resumo diz', async () => {
    const ports = fakePorts()
    ports.toolchain.locate = async () => null
    const { ctx, notes } = fakeContext(ports, node)

    const result = await runSteps({ steps: { runtimePackages: ['pnpm'] } }, ctx)

    expect(result.packagesFailed).toEqual(['pnpm'])
    expect(notes.join(' ')).toContain('não achei o npm')
  })

  it('um programa que não é runtime não roda nada', async () => {
    const ports = fakePorts()
    let called = false
    ports.toolchain.run = async () => {
      called = true
      return true
    }
    const { ctx } = fakeContext(ports, vscode)

    await runSteps({ steps: { runtimePackages: ['pnpm'] } }, ctx)

    expect(called).toBe(false)
  })
})
