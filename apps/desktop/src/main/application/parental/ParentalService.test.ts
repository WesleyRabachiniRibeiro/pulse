import { describe, expect, it } from 'vitest'
import { EMPTY_PARENTAL, type Parental } from '@pulse/domain'
import { ParentalService } from './ParentalService'
import type { ParentalStore } from '../../ports/parental-store'
import type { PinSealer } from '../../ports/pin-sealer'

function fakeStore(initial: Parental = EMPTY_PARENTAL): ParentalStore & { current: Parental } {
  let current = initial
  return {
    get current() {
      return current
    },
    read: async () => current,
    write: async (next) => {
      current = next
    },
  }
}

const sealer: PinSealer = {
  seal: (digits) => `sealed:${digits}`,
  matches: (secret, digits) => secret === `sealed:${digits}`,
}

function make(initial?: Parental) {
  const store = fakeStore(initial)
  return { store, service: new ParentalService(store, sealer) }
}

const WITH_PIN: Parental = { on: true, secret: 'sealed:1234', blocked: ['steam'] }

describe('ParentalService', () => {
  it('o renderer recebe se existe PIN, nunca o PIN', async () => {
    const { service } = make(WITH_PIN)
    const view = await service.view()

    expect(view).toEqual({ on: true, hasPin: true, blocked: ['steam'] })
    expect(JSON.stringify(view)).not.toContain('sealed')
  })

  it('o primeiro PIN liga o controle e fica guardado embaralhado', async () => {
    const { store, service } = make()

    const result = await service.turnOn('1234')

    expect(result.ok).toBe(true)
    expect(store.current.on).toBe(true)
    expect(store.current.secret).toBe('sealed:1234')
  })

  it('PIN fora do formato é recusado', async () => {
    const { store, service } = make()

    for (const bad of ['', '12', '12345', 'abcd', '12a4']) {
      expect((await service.turnOn(bad)).ok, bad).toBe(false)
    }
    expect(store.current.secret).toBeUndefined()
  })

  it('religar com PIN errado não troca o PIN guardado', async () => {
    const { store, service } = make({ ...WITH_PIN, on: false })

    const result = await service.turnOn('9999')

    expect(result.ok).toBe(false)
    expect(store.current.secret).toBe('sealed:1234')
    expect(store.current.on).toBe(false)
  })

  it('religar com o PIN certo volta a trancar', async () => {
    const { store, service } = make({ ...WITH_PIN, on: false })

    expect((await service.turnOn('1234')).ok).toBe(true)
    expect(store.current.on).toBe(true)
  })

  it('desligar exige o PIN certo', async () => {
    const { store, service } = make(WITH_PIN)

    expect((await service.turnOff('9999')).ok).toBe(false)
    expect(store.current.on).toBe(true)

    expect((await service.turnOff('1234')).ok).toBe(true)
    expect(store.current.on).toBe(false)
  })

  it('trocar o PIN pede o atual e recusa um novo fora do formato', async () => {
    const { store, service } = make(WITH_PIN)

    expect((await service.change('9999', '5678')).ok).toBe(false)
    expect((await service.change('1234', '12')).ok).toBe(false)
    expect(store.current.secret).toBe('sealed:1234')

    expect((await service.change('1234', '5678')).ok).toBe(true)
    expect(store.current.secret).toBe('sealed:5678')
  })

  it('sem PIN cadastrado nada confere, nem texto vazio', async () => {
    const { service } = make()

    expect(await service.check('')).toBe(false)
    expect(await service.check('1234')).toBe(false)
  })

  it('a lista de bloqueados sai sem repetido e ordenada', async () => {
    const { service } = make(WITH_PIN)

    const view = await service.setBlocked(['steam', 'discord', 'steam'])

    expect(view.blocked).toEqual(['discord', 'steam'])
  })

  it('mexer na lista não mexe no PIN nem em estar ligado', async () => {
    const { store, service } = make(WITH_PIN)

    await service.setBlocked(['discord'])

    expect(store.current.secret).toBe('sealed:1234')
    expect(store.current.on).toBe(true)
  })
})
