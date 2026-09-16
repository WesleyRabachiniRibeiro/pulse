import { describe, expect, it } from 'vitest'
import { WingetPackageInstaller } from './WingetPackageInstaller'
import { NO_UNELEVATED_SESSION } from '../process/interactiveUserOutcome'
import type { ProcessRunner, SpawnResult } from '../../ports/process-runner'

interface Fake {
  runner: ProcessRunner
  calls: () => string[]
}

function fakeRunner(over: {
  elevated?: boolean
  asUser?: SpawnResult
  direct?: SpawnResult
}): Fake {
  const calls: string[] = []

  const runner = {
    isElevated: async () => over.elevated ?? false,
    runAsInteractiveUser: async () => {
      calls.push('asUser')
      return over.asUser ?? { code: 0, text: '' }
    },
    runWinget: async () => {
      calls.push('direct')
      return over.direct ?? { code: 0, text: '' }
    },
  } as unknown as ProcessRunner

  return { runner, calls: () => calls }
}

describe('desinstalar pelo winget', () => {
  it('elevado, desce para a sessão do usuário', async () => {
    const fake = fakeRunner({ elevated: true })
    const outcome = await new WingetPackageInstaller(fake.runner).uninstall('x', 'X.X', 'X')

    expect(fake.calls()).toEqual(['asUser'])
    expect(outcome).toEqual({ kind: 'ok' })
  })

  it('sem elevação, vai direto', async () => {
    const fake = fakeRunner({ elevated: false })
    await new WingetPackageInstaller(fake.runner).uninstall('x', 'X.X', 'X')

    expect(fake.calls()).toEqual(['direct'])
  })

  it('UAC desligado: tenta direto em vez de desistir', async () => {
    const fake = fakeRunner({
      elevated: true,
      asUser: { code: NO_UNELEVATED_SESSION, text: '' },
      direct: { code: 0, text: '' },
    })

    const outcome = await new WingetPackageInstaller(fake.runner).uninstall('x', 'X.X', 'X')

    expect(fake.calls()).toEqual(['asUser', 'direct'])
    expect(outcome).toEqual({ kind: 'ok' })
  })

  it('UAC desligado e winget recusando: o erro é o do winget', async () => {
    const fake = fakeRunner({
      elevated: true,
      asUser: { code: NO_UNELEVATED_SESSION, text: '' },
      direct: { code: -1978335212, text: 'winget nao conseguiu' },
    })

    const outcome = await new WingetPackageInstaller(fake.runner).uninstall('x', 'X.X', 'Blender')

    expect(outcome.kind).toBe('failed')
    expect(outcome).not.toHaveProperty('reason')
  })

  it('outra falha do mecanismo continua bloqueando, sem segunda tentativa', async () => {
    const fake = fakeRunner({ elevated: true, asUser: { code: -1007, text: '' } })
    const outcome = await new WingetPackageInstaller(fake.runner).uninstall('x', 'X.X', 'X')

    expect(fake.calls()).toEqual(['asUser'])
    expect(outcome.kind).toBe('blocked')
  })

  it('pacote que o winget não gerencia é dito como tal', async () => {
    const fake = fakeRunner({
      elevated: false,
      direct: { code: 1, text: 'No installed package found matching input criteria.' },
    })

    expect((await new WingetPackageInstaller(fake.runner).uninstall('x', 'X.X', 'X')).kind).toBe(
      'not-managed',
    )
  })
})
