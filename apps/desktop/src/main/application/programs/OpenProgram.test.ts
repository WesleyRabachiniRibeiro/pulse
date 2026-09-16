import { describe, expect, it } from 'vitest'
import type { Catalog, Program } from '@pulse/domain'
import { OpenProgram } from './OpenProgram'
import type { ProgramOpener } from '../../ports/program-opener'

const PROGRAMS = [
  { id: 'chrome', name: 'Chrome', hints: ['chrome'] },
  { id: 'steam', name: 'Steam', hints: ['steam'] },
] as unknown as Program[]

const CATALOG = {
  programs: PROGRAMS,
  byId: new Map(PROGRAMS.map((one) => [one.id, one])),
} as unknown as Catalog

function fakeOpener(overrides: Partial<ProgramOpener> = {}) {
  let scans = 0
  let opened: string[] = []

  const opener: ProgramOpener = {
    find: async () => {
      scans += 1
      return { chrome: 'C:/Menu/Chrome.lnk' }
    },
    open: async (path) => {
      opened.push(path)
      return true
    },
    ...overrides,
  }

  return {
    opener,
    scans: () => scans,
    opened: () => opened,
  }
}

describe('abrir um programa instalado', () => {
  it('diz quais dos pedidos têm atalho', async () => {
    const { opener } = fakeOpener()
    const service = new OpenProgram(CATALOG, opener)

    expect(await service.openable(['chrome', 'steam'])).toEqual(['chrome'])
  })

  it('varre uma vez só e reaproveita', async () => {
    const fake = fakeOpener()
    const service = new OpenProgram(CATALOG, fake.opener)

    await service.openable(['chrome'])
    await service.openable(['steam'])
    await service.open('chrome')

    expect(fake.scans()).toBe(1)
  })

  it('perguntas ao mesmo tempo não viram duas varreduras', async () => {
    const fake = fakeOpener()
    const service = new OpenProgram(CATALOG, fake.opener)

    await Promise.all([service.openable(['chrome']), service.openable(['steam'])])

    expect(fake.scans()).toBe(1)
  })

  it('abre pelo atalho que encontrou', async () => {
    const fake = fakeOpener()
    const service = new OpenProgram(CATALOG, fake.opener)

    expect(await service.open('chrome')).toBe(true)
    expect(fake.opened()).toEqual(['C:/Menu/Chrome.lnk'])
  })

  it('quem não tem atalho não abre, e nada é chamado', async () => {
    const fake = fakeOpener()
    const service = new OpenProgram(CATALOG, fake.opener)

    expect(await service.open('steam')).toBe(false)
    expect(fake.opened()).toEqual([])
  })

  it('falhar ao abrir joga a varredura fora', async () => {
    const fake = fakeOpener({ open: async () => false })
    const service = new OpenProgram(CATALOG, fake.opener)

    await service.open('chrome')
    await service.openable(['chrome'])

    expect(fake.scans()).toBe(2)
  })
})
