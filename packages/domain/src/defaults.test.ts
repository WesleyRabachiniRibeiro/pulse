import { describe, expect, it } from 'vitest'
import { defaultLabel, EMPTY_DEFAULTS, type Defaults } from './defaults'
import { overriddenKeys, programsOverriding, withDefaults, type Settings } from './settings'

const DEFAULTS: Defaults = { scope: 'user', locale: 'pt-BR', interactive: false }

describe('padrões de instalação', () => {
  it('sem padrão nenhum, os ajustes do programa passam intactos', () => {
    const settings: Settings = { scope: 'machine' }
    expect(withDefaults(settings, EMPTY_DEFAULTS)).toEqual(settings)
  })

  it('o padrão preenche o que o programa não pediu', () => {
    expect(withDefaults({}, DEFAULTS)).toEqual({
      scope: 'user',
      locale: 'pt-BR',
      interactive: false,
    })
  })

  it('o que o programa pediu ganha do padrão', () => {
    const merged = withDefaults({ scope: 'machine' }, DEFAULTS)
    expect(merged.scope).toBe('machine')
    expect(merged.locale).toBe('pt-BR')
  })

  // Falso é uma escolha, não ausência: quem pediu "não abrir" não pode ser
  // sobrescrito pelo padrão que diz "abrir".
  it('falso no programa não é tratado como ausência', () => {
    expect(withDefaults({ autostart: false }, { autostart: true }).autostart).toBe(false)
  })

  it('não inventa campo que ninguém pediu', () => {
    expect(withDefaults(undefined, EMPTY_DEFAULTS)).toEqual({})
  })

  it('o que o programa traz de fora dos padrões continua lá', () => {
    const merged = withDefaults({ packageId: 'Some.Id' }, DEFAULTS)
    expect(merged.packageId).toBe('Some.Id')
  })
})

describe('exceções ao padrão', () => {
  const byApp: Record<string, Settings> = {
    steam: { scope: 'machine' },
    discord: { scope: 'user' },
    chrome: { locale: 'en-US' },
    vscode: {},
  }

  it('lista só quem pediu diferente do padrão naquele campo', () => {
    expect(programsOverriding(byApp, DEFAULTS, 'scope')).toEqual(['steam'])
    expect(programsOverriding(byApp, DEFAULTS, 'locale')).toEqual(['chrome'])
  })

  it('pedir o mesmo que o padrão não é exceção', () => {
    expect(programsOverriding(byApp, { scope: 'machine' }, 'scope')).toEqual(['discord'])
  })

  it('campo que ninguém tocou não tem exceção', () => {
    expect(programsOverriding(byApp, DEFAULTS, 'desktopShortcut')).toEqual([])
  })
})

describe('em que um programa foge do padrão', () => {
  it('lista os campos que diferem', () => {
    expect(overriddenKeys({ scope: 'machine', locale: 'en-US' }, DEFAULTS)).toEqual([
      'scope',
      'locale',
    ])
  })

  it('pedir o mesmo que o padrão não conta', () => {
    expect(overriddenKeys({ scope: 'user' }, DEFAULTS)).toEqual([])
  })

  it('sem ajuste nenhum, nada foge', () => {
    expect(overriddenKeys(undefined, DEFAULTS)).toEqual([])
    expect(overriddenKeys({}, DEFAULTS)).toEqual([])
  })

  it('campo fora dos padrões não é exceção', () => {
    expect(overriddenKeys({ packageId: 'X' }, DEFAULTS)).toEqual([])
  })
})

describe('como o padrão se lê', () => {
  it('sem padrão, diz o que acontece por omissão', () => {
    expect(defaultLabel('scope', EMPTY_DEFAULTS)).toBe('do jeito do programa')
    expect(defaultLabel('interactive', EMPTY_DEFAULTS)).toBe('em silêncio')
  })

  it('com padrão, diz o que foi escolhido', () => {
    expect(defaultLabel('scope', { scope: 'machine' })).toBe('para todos')
    expect(defaultLabel('interactive', { interactive: true })).toBe('mostrar')
    expect(defaultLabel('autostart', { autostart: false })).toBe('não abrir')
  })

  it('o idioma vira o nome da língua, não a etiqueta', () => {
    expect(defaultLabel('locale', { locale: 'pt-BR' })).toBe('Português')
    expect(defaultLabel('locale', { locale: 'ja-JP' })).toBe('ja-JP')
  })
})
