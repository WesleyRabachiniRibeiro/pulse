import { describe, expect, it } from 'vitest'
import {
  blockedAmong,
  EMPTY_PARENTAL,
  hasPin,
  isBlocked,
  locked,
  parentalSchema,
  PIN_LENGTH,
  pinIsValid,
  toggleBlocked,
  withBlocked,
  type Parental,
} from './parental'

function guarda(over: Partial<Parental> = {}): Parental {
  return { on: true, secret: 'sal:resumo', blocked: ['steam'], ...over }
}

describe('pinIsValid', () => {
  it('aceita exatamente os dígitos do tamanho combinado', () => {
    expect(pinIsValid('1234')).toBe(true)
    expect(PIN_LENGTH).toBe(4)
  })

  it('recusa curto, comprido e com letra', () => {
    expect(pinIsValid('123')).toBe(false)
    expect(pinIsValid('12345')).toBe(false)
    expect(pinIsValid('12a4')).toBe(false)
    expect(pinIsValid('')).toBe(false)
  })
})

describe('locked', () => {
  it('ligado com PIN é a única combinação que tranca', () => {
    expect(locked(guarda())).toBe(true)
  })

  it('desligado não tranca, mesmo com lista e PIN', () => {
    expect(locked(guarda({ on: false }))).toBe(false)
  })

  it('ligado sem PIN não tranca, senão ninguém destravaria', () => {
    expect(locked(guarda({ secret: undefined }))).toBe(false)
    expect(locked(guarda({ secret: '   ' }))).toBe(false)
  })

  it('o estado de partida vem desligado e sem PIN', () => {
    expect(locked(EMPTY_PARENTAL)).toBe(false)
    expect(hasPin(EMPTY_PARENTAL)).toBe(false)
  })
})

describe('isBlocked', () => {
  it('bloqueia quem está na lista, com o controle ligado', () => {
    expect(isBlocked(guarda(), 'steam')).toBe(true)
  })

  it('não bloqueia quem está fora da lista', () => {
    expect(isBlocked(guarda(), 'chrome')).toBe(false)
  })

  it('desligado não bloqueia ninguém, e a lista fica guardada', () => {
    const desligado = guarda({ on: false })
    expect(isBlocked(desligado, 'steam')).toBe(false)
    expect(desligado.blocked).toEqual(['steam'])
  })
})

describe('blockedAmong', () => {
  it('devolve só os bloqueados do lote', () => {
    const parental = guarda({ blocked: ['steam', 'discord'] })
    expect(blockedAmong(parental, ['chrome', 'steam', 'discord']).sort()).toEqual([
      'discord',
      'steam',
    ])
  })

  it('não repete quando o mesmo id vem duas vezes', () => {
    expect(blockedAmong(guarda(), ['steam', 'steam'])).toEqual(['steam'])
  })

  it('com o controle desligado, o lote passa inteiro', () => {
    expect(blockedAmong(guarda({ on: false }), ['steam'])).toEqual([])
  })
})

describe('mexer na lista', () => {
  it('marcar bloqueia e marcar de novo libera', () => {
    const um = toggleBlocked(guarda({ blocked: [] }), 'chrome')
    expect(um.blocked).toEqual(['chrome'])
    expect(toggleBlocked(um, 'chrome').blocked).toEqual([])
  })

  it('a lista sai sem repetido e em ordem, para o arquivo não variar à toa', () => {
    expect(withBlocked(guarda(), ['steam', 'chrome', 'steam']).blocked).toEqual([
      'chrome',
      'steam',
    ])
  })

  it('mexer na lista não mexe no PIN nem no estado', () => {
    const depois = withBlocked(guarda(), ['chrome'])
    expect(depois.on).toBe(true)
    expect(depois.secret).toBe('sal:resumo')
  })

  it('sai no formato que o contrato aceita', () => {
    expect(parentalSchema.safeParse(withBlocked(guarda(), ['chrome'])).success).toBe(true)
  })
})
