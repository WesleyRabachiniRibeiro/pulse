import { describe, expect, it } from 'vitest'
import {
  readTweakState,
  TWEAKS,
  TWEAK_BY_ID,
  tweaksTouchingExplorer,
  valueIdOf,
} from './windows'

function found(pairs: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(pairs))
}

const dark = TWEAK_BY_ID.get('darkMode')!
const ext = TWEAK_BY_ID.get('fileExtensions')!

describe('ajustes do Windows', () => {
  it('todo ajuste tem id único e ao menos um valor', () => {
    const ids = TWEAKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const tweak of TWEAKS) {
      expect(tweak.values.length, `${tweak.id} sem valor`).toBeGreaterThan(0)
    }
  })

  it('todos mexem só na conta do usuário, nunca na máquina', () => {
    for (const tweak of TWEAKS) {
      for (const value of tweak.values) {
        expect(value.key.startsWith('HKCU'), `${tweak.id} sai de HKCU`).toBe(true)
      }
    }
  })

  it('ligado e desligado são valores diferentes', () => {
    for (const tweak of TWEAKS) {
      for (const value of tweak.values) {
        expect(value.on, `${tweak.id}/${value.name}`).not.toBe(value.off)
      }
    }
  })

  // Meio ligado é o Windows em estado inconsistente, e a tela precisa mostrar
  // desligado para a pessoa conseguir corrigir clicando.
  it('um ajuste de dois valores só conta como ligado com os dois ligados', () => {
    const [a, b] = dark.values
    if (!a || !b) throw new Error('esperava dois valores')

    expect(readTweakState(dark, found({ [valueIdOf(a)]: a.on, [valueIdOf(b)]: b.on }))).toBe(true)
    expect(readTweakState(dark, found({ [valueIdOf(a)]: a.on, [valueIdOf(b)]: b.off }))).toBe(false)
  })

  it('chave ausente no registro conta como desligado', () => {
    expect(readTweakState(ext, found({}))).toBe(false)
  })

  it('valor inesperado no registro conta como desligado', () => {
    const [only] = ext.values
    if (!only) throw new Error('esperava um valor')
    expect(readTweakState(ext, found({ [valueIdOf(only)]: 99 }))).toBe(false)
  })

  it('sabe quais pedem para o Explorador reler', () => {
    expect(tweaksTouchingExplorer(['fileExtensions'])).toBe(true)
    expect(tweaksTouchingExplorer(['darkMode'])).toBe(false)
    expect(tweaksTouchingExplorer(['darkMode', 'explorerThisPc'])).toBe(true)
    expect(tweaksTouchingExplorer(['inexistente'])).toBe(false)
  })
})
