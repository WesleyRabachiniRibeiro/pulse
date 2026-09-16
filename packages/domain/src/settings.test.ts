import { describe, expect, it } from 'vitest'
import { settingsAreEmpty, settingsSummary } from './settings'

describe('settingsAreEmpty', () => {
  it('nada, objeto vazio e listas vazias contam como sem ajuste', () => {
    expect(settingsAreEmpty(undefined)).toBe(true)
    expect(settingsAreEmpty({})).toBe(true)
    expect(settingsAreEmpty({ steps: {} })).toBe(true)
    expect(settingsAreEmpty({ steps: { vscodeExtensions: [] } })).toBe(true)
  })

  it('desligar a inicialização é um pedido, não a ausência de um', () => {
    expect(settingsAreEmpty({ autostart: false })).toBe(false)
    expect(settingsAreEmpty({ autostart: true })).toBe(false)
  })

  it('escolher a versão do pacote conta como ajuste', () => {
    expect(settingsAreEmpty({ packageId: 'Node.LTS' })).toBe(false)
  })
})

describe('settingsSummary', () => {
  it('sem ajuste, não há resumo', () => {
    expect(settingsSummary(undefined)).toBeNull()
    expect(settingsSummary({})).toBeNull()
    expect(settingsSummary({ steps: { vscodeExtensions: [] } })).toBeNull()
  })

  it('junta os pedaços na ordem do registro, separados por ponto', () => {
    expect(
      settingsSummary({
        steps: {
          vscodeExtensions: ['a', 'b'],
          gitConfig: { name: 'Wesley', email: '', branch: 'main', saveLogin: true },
          browserDefault: { makeDefault: true },
        },
      }),
    ).toBe('2 extensões · Git configurado · login do GitHub guardado · navegador padrão')
  })

  it('a inicialização entra por último e diz o que vai acontecer', () => {
    expect(settingsSummary({ autostart: true })).toBe('abre com o Windows')
    expect(settingsSummary({ autostart: false })).toBe('não abre sozinho')
    expect(settingsSummary({ steps: { vscodeExtensions: ['a'] }, autostart: true })).toBe(
      '1 extensão · abre com o Windows',
    )
  })
})
