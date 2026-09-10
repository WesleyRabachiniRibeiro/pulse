import { describe, expect, it } from 'vitest'
import {
  applyDefaults,
  countOverrides,
  DEFAULT_KEYS,
  defaultLabel,
  EMPTY_DEFAULTS,
  overriddenKeys,
  programsOverriding,
  type Defaults,
} from './defaults'
import { defaultsOf, preferencesSchema } from './preferences'
import { settingsAreEmpty, type Settings } from './settings'

const padrao: Defaults = { scope: 'user', locale: 'pt-BR', interactive: false, autostart: true }

describe('applyDefaults', () => {
  it('preenche o que o programa não escolheu', () => {
    expect(applyDefaults({}, padrao)).toEqual({
      scope: 'user',
      locale: 'pt-BR',
      interactive: false,
      autostart: true,
    })
  })

  it('não encosta no que o programa escolheu', () => {
    const merged = applyDefaults({ scope: 'machine' }, padrao)
    expect(merged.scope).toBe('machine')
    expect(merged.locale).toBe('pt-BR')
  })

  it('respeita a escolha de não fazer nada, que é diferente de não escolher', () => {
    const merged = applyDefaults({ autostart: false }, padrao)
    expect(merged.autostart).toBe(false)
  })

  it('não inventa valor quando o padrão também está vazio', () => {
    expect(settingsAreEmpty(applyDefaults({}, EMPTY_DEFAULTS))).toBe(true)
  })

  it('deixa em paz os campos que não são padrão global', () => {
    const settings: Settings = { steps: { vscodeExtensions: ['prettier'] }, packageId: 'X' }
    const merged = applyDefaults(settings, padrao)
    expect(merged.steps?.vscodeExtensions).toEqual(['prettier'])
    expect(merged.packageId).toBe('X')
  })

  it('não mexe no objeto que recebeu', () => {
    const settings: Settings = {}
    applyDefaults(settings, padrao)
    expect(settings).toEqual({})
  })

  it('aceita programa sem ajuste nenhum', () => {
    expect(applyDefaults(undefined, padrao).scope).toBe('user')
  })
})

describe('overriddenKeys', () => {
  it('não vê exceção quando o programa segue o padrão', () => {
    expect(overriddenKeys({ scope: 'user' }, padrao)).toEqual([])
    expect(overriddenKeys({}, padrao)).toEqual([])
    expect(overriddenKeys(undefined, padrao)).toEqual([])
  })

  it('vê exceção quando o programa discorda', () => {
    expect(overriddenKeys({ scope: 'machine' }, padrao)).toEqual(['scope'])
  })

  it('escolher o contrário de um padrão ligado é exceção', () => {
    expect(overriddenKeys({ autostart: false }, padrao)).toEqual(['autostart'])
  })

  it('escolher algo onde não há padrão também é exceção', () => {
    expect(overriddenKeys({ desktopShortcut: true }, padrao)).toEqual(['desktopShortcut'])
  })

  it('junta mais de uma exceção', () => {
    const chaves = overriddenKeys({ scope: 'machine', locale: 'en-US' }, padrao)
    expect(chaves.sort()).toEqual(['locale', 'scope'])
  })
})

describe('contagem de exceções', () => {
  const porPrograma: Record<string, Settings> = {
    chrome: { scope: 'machine' },
    vim: { scope: 'user' },
    docker: { locale: 'en-US', steps: { vscodeExtensions: [] } },
    node: { steps: { vscodeExtensions: ['typescript'] } },
  }

  it('conta só quem foge do padrão', () => {
    expect(countOverrides(porPrograma, padrao)).toBe(2)
  })

  it('não conta ajuste que não é padrão global', () => {
    expect(countOverrides({ node: { steps: { vscodeExtensions: ['typescript'] } } }, padrao)).toBe(0)
  })

  it('diz quem foge de um padrão específico', () => {
    expect(programsOverriding(porPrograma, padrao, 'scope')).toEqual(['chrome'])
    expect(programsOverriding(porPrograma, padrao, 'locale')).toEqual(['docker'])
  })

  it('devolve vazio quando ninguém foge', () => {
    expect(countOverrides({}, padrao)).toBe(0)
    expect(programsOverriding({}, padrao, 'scope')).toEqual([])
  })
})

describe('defaultLabel', () => {
  it('fala em português de cada padrão escolhido', () => {
    expect(defaultLabel('scope', { scope: 'machine' })).toBe('para todos os usuários')
    expect(defaultLabel('locale', { locale: 'pt-BR' })).toBe('Português do Brasil')
    expect(defaultLabel('interactive', { interactive: true })).toBe('mostrar a janela')
    expect(defaultLabel('desktopShortcut', { desktopShortcut: true })).toBe('criar o atalho')
    expect(defaultLabel('autostart', { autostart: false })).toBe('não abrir sozinho')
  })

  it('tem uma frase para quando nada foi escolhido', () => {
    for (const key of DEFAULT_KEYS) {
      expect(defaultLabel(key, EMPTY_DEFAULTS).length).toBeGreaterThan(0)
    }
  })
})

describe('padrões dentro das preferências', () => {
  it('preferência antiga, sem padrões, continua válida', () => {
    const lido = preferencesSchema.safeParse({ drive: 'D:', tourSeen: true })
    expect(lido.success).toBe(true)
    expect(lido.success && defaultsOf(lido.data)).toEqual(EMPTY_DEFAULTS)
  })

  it('guarda e devolve os padrões', () => {
    const lido = preferencesSchema.safeParse({ drive: 'D:', defaults: { scope: 'user' } })
    expect(lido.success && defaultsOf(lido.data).scope).toBe('user')
  })

  it('recusa padrão inventado', () => {
    expect(preferencesSchema.safeParse({ defaults: { scope: 'talvez' } }).success).toBe(false)
  })
})
