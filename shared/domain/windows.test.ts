import { describe, expect, it } from 'vitest'
import { readTweakState, TWEAK_BY_ID, TWEAKS, tweaksTouchingExplorer } from './windows'

function found(pairs: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(pairs))
}

const EXPLORER = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'
const THEMES = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'

describe('lista de ajustes', () => {
  it('não tem id repetido', () => {
    expect(new Set(TWEAKS.map((t) => t.id)).size).toBe(TWEAKS.length)
  })

  it('todo ajuste mexe em pelo menos um valor', () => {
    for (const tweak of TWEAKS) expect(tweak.values.length).toBeGreaterThan(0)
  })

  it('ligado e desligado nunca são o mesmo número', () => {
    for (const tweak of TWEAKS) {
      for (const value of tweak.values) expect(value.on).not.toBe(value.off)
    }
  })

  it('só mexe na conta do usuário, nunca na máquina inteira', () => {
    for (const tweak of TWEAKS) {
      for (const value of tweak.values) expect(value.key.startsWith('HKCU\\')).toBe(true)
    }
  })
})

describe('readTweakState', () => {
  const extensions = TWEAK_BY_ID.get('fileExtensions')
  const dark = TWEAK_BY_ID.get('darkMode')

  it('ligado quando o valor bate', () => {
    expect(extensions && readTweakState(extensions, found({ [`${EXPLORER}\\HideFileExt`]: 0 }))).toBe(
      true,
    )
  })

  it('desligado quando o valor é outro', () => {
    expect(extensions && readTweakState(extensions, found({ [`${EXPLORER}\\HideFileExt`]: 1 }))).toBe(
      false,
    )
  })

  it('desligado quando o valor nem existe no registro', () => {
    expect(extensions && readTweakState(extensions, found({}))).toBe(false)
  })

  it('só está ligado quando todos os valores batem', () => {
    const meio = found({ [`${THEMES}\\AppsUseLightTheme`]: 0 })
    const inteiro = found({
      [`${THEMES}\\AppsUseLightTheme`]: 0,
      [`${THEMES}\\SystemUsesLightTheme`]: 0,
    })

    expect(dark && readTweakState(dark, meio)).toBe(false)
    expect(dark && readTweakState(dark, inteiro)).toBe(true)
  })
})

describe('tweaksTouchingExplorer', () => {
  it('reconhece quem pede para o Explorador se atualizar', () => {
    expect(tweaksTouchingExplorer(['fileExtensions'])).toBe(true)
    expect(tweaksTouchingExplorer(['explorerThisPc'])).toBe(true)
  })

  it('não pede atualização à toa', () => {
    expect(tweaksTouchingExplorer(['darkMode'])).toBe(false)
    expect(tweaksTouchingExplorer([])).toBe(false)
    expect(tweaksTouchingExplorer(['nao-existe'])).toBe(false)
  })
})
