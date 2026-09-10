import { describe, expect, it } from 'vitest'
import { settingsSchema, settingsSummary, settingsAreEmpty } from '../settings'
import { STEPS, STEP_BY_ID, stepsFor, stepsSchema, STEPS_BY_KIND } from './index'

describe('registro de passos', () => {
  it('não repete identificador', () => {
    const ids = STEPS.map((step) => step.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('todo passo entra no schema', () => {
    const declared = Object.keys(stepsSchema.shape)
    expect([...declared].sort()).toEqual(STEPS.map((step) => step.id).sort())
  })

  it('todo passo tem título e descrição', () => {
    for (const step of STEPS) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.description.length).toBeGreaterThan(0)
    }
  })

  it('todo kind aponta para passo que existe', () => {
    for (const ids of Object.values(STEPS_BY_KIND)) {
      for (const id of ids) expect(STEP_BY_ID.has(id)).toBe(true)
    }
  })

  it('passo de lista traz opção, direto ou por programa', () => {
    for (const step of STEPS) {
      if (!step.options && !step.optionsFor) continue
      const some = step.options ?? step.optionsFor?.('node') ?? []
      expect(Array.isArray(some)).toBe(true)
    }
  })
})

describe('stepsFor', () => {
  it('lê a lista publicada no catálogo', () => {
    const found = stepsFor({ id: 'x', steps: ['gitConfig', 'steamGames'] })
    expect(found.map((step) => step.id)).toEqual(['gitConfig', 'steamGames'])
  })

  it('cai no settingsKind quando o catálogo ainda não traz steps', () => {
    const found = stepsFor({ id: 'vscode', settingsKind: 'vscode' })
    expect(found.map((step) => step.id)).toEqual(['vscodeExtensions', 'editorTweaks'])
  })

  it('ignora passo desconhecido, para catálogo mais novo que o app', () => {
    const found = stepsFor({ id: 'x', steps: ['gitConfig', 'inventadoAmanha'] })
    expect(found.map((step) => step.id)).toEqual(['gitConfig'])
  })

  it('esconde passo sem opção para aquele programa', () => {
    expect(stepsFor({ id: 'node', steps: ['runtimePackages'] })).toHaveLength(1)
    expect(stepsFor({ id: 'chrome', steps: ['runtimePackages'] })).toHaveLength(0)
  })
})

describe('migração do formato plano', () => {
  it('levanta as listas para dentro de steps', () => {
    const read = settingsSchema.parse({
      extensions: ['esbenp.prettier-vscode'],
      editorTweaks: ['format-on-save'],
      globalPackages: ['typescript'],
      tibia: ['medivia'],
      riot: ['RiotGames.Valorant.BR'],
      workloads: ['Microsoft.VisualStudio.Workload.NativeDesktop'],
    })

    expect(read.steps).toEqual({
      vscodeExtensions: ['esbenp.prettier-vscode'],
      editorTweaks: ['format-on-save'],
      runtimePackages: ['typescript'],
      tibiaPages: ['medivia'],
      riotProducts: ['RiotGames.Valorant.BR'],
      vsWorkloads: ['Microsoft.VisualStudio.Workload.NativeDesktop'],
    })
  })

  it('levanta o git e os jogos da Steam', () => {
    const read = settingsSchema.parse({
      git: { name: 'Wesley', email: 'w@exemplo.com', branch: 'main' },
      games: [{ appid: '570', name: 'Dota 2' }],
    })

    expect(read.steps?.gitConfig?.name).toBe('Wesley')
    expect(read.steps?.steamGames).toHaveLength(1)
  })

  it('junta makeDefault e openAfter num passo só', () => {
    const read = settingsSchema.parse({ makeDefault: true, openAfter: true })
    expect(read.steps?.browserDefault).toEqual({ makeDefault: true, openAfter: true })
  })

  it('deixa planos os campos que têm padrão geral', () => {
    const read = settingsSchema.parse({
      scope: 'machine',
      locale: 'pt-BR',
      interactive: true,
      desktopShortcut: false,
      autostart: true,
      packageId: 'OpenJS.NodeJS.LTS',
    })

    expect(read.scope).toBe('machine')
    expect(read.desktopShortcut).toBe(false)
    expect(read.autostart).toBe(true)
    expect(read.packageId).toBe('OpenJS.NodeJS.LTS')
    expect(read.steps).toBeUndefined()
  })

  it('não mexe no que já veio aninhado', () => {
    const nested = { steps: { vscodeExtensions: ['eamodio.gitlens'] } }
    expect(settingsSchema.parse(nested)).toEqual(nested)
  })

  it('o que já está aninhado ganha do campo plano antigo', () => {
    const read = settingsSchema.parse({
      extensions: ['antigo'],
      steps: { vscodeExtensions: ['novo'] },
    })

    expect(read.steps?.vscodeExtensions).toEqual(['novo'])
  })

  it('perfil antigo continua resumindo igual', () => {
    const antigo = settingsSchema.parse({
      scope: 'machine',
      extensions: ['a', 'b'],
      git: { name: 'Wesley', email: '', branch: '' },
    })

    expect(settingsAreEmpty(antigo)).toBe(false)
    expect(settingsSummary(antigo)).toContain('2 extensões')
  })
})
