import { describe, expect, it } from 'vitest'
import {
  blockedAmong,
  EMPTY_PARENTAL,
  isBlocked,
  locked,
  pinIsValid,
  toggleBlocked,
  withBlocked,
  type Parental,
} from './parental'

const ON: Parental = { on: true, secret: 'x', blocked: ['steam', 'discord'] }

describe('controle parental', () => {
  it('o PIN são quatro dígitos, nada além disso', () => {
    expect(pinIsValid('1234')).toBe(true)
    for (const bad of ['', '123', '12345', 'abcd', '12 4', '12.4', ' 1234']) {
      expect(pinIsValid(bad), bad).toBe(false)
    }
  })

  // Ligado sem PIN não tranca: não há o que conferir, e travar tudo sem saída
  // seria pior do que não travar.
  it('ligado sem PIN não tranca nada', () => {
    expect(locked({ on: true, blocked: ['steam'] })).toBe(false)
    expect(isBlocked({ on: true, blocked: ['steam'] }, 'steam')).toBe(false)
  })

  it('desligado não tranca, mesmo com PIN e lista', () => {
    expect(locked({ ...ON, on: false })).toBe(false)
    expect(isBlocked({ ...ON, on: false }, 'steam')).toBe(false)
  })

  it('ligado e com PIN, o que está na lista está bloqueado', () => {
    expect(isBlocked(ON, 'steam')).toBe(true)
    expect(isBlocked(ON, 'chrome')).toBe(false)
  })

  it('diz quais de uma seleção estão bloqueados, sem repetir', () => {
    expect(blockedAmong(ON, ['chrome', 'steam', 'steam', 'discord'])).toEqual(['steam', 'discord'])
    expect(blockedAmong({ ...ON, on: false }, ['steam'])).toEqual([])
  })

  it('a lista é guardada sem repetido e ordenada', () => {
    expect(withBlocked(EMPTY_PARENTAL, ['steam', 'discord', 'steam']).blocked).toEqual([
      'discord',
      'steam',
    ])
  })

  it('alternar acrescenta e tira', () => {
    const added = toggleBlocked(EMPTY_PARENTAL, 'steam')
    expect(added.blocked).toEqual(['steam'])
    expect(toggleBlocked(added, 'steam').blocked).toEqual([])
  })
})
