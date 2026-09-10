import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PROFILE } from '@shared/domain/profile'

let userData = ''

vi.mock('electron', () => ({
  app: { getPath: (): string => userData },
}))

const { forgetProfile, readProfile, writeProfile } = await import('./profile.service')

function file(): string {
  return join(userData, 'profile.json')
}

beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'pulse-profile-'))
  forgetProfile()
})

afterEach(async () => {
  await rm(userData, { recursive: true, force: true })
})

describe('readProfile', () => {
  it('devolve vazio quando o arquivo não existe', async () => {
    await expect(readProfile()).resolves.toEqual(EMPTY_PROFILE)
  })

  it('devolve vazio quando o arquivo está corrompido', async () => {
    await writeFile(file(), 'isto não é json', 'utf8')
    await expect(readProfile()).resolves.toEqual(EMPTY_PROFILE)
  })

  it('devolve vazio quando o formato não bate', async () => {
    await writeFile(file(), JSON.stringify({ selected: 'chrome' }), 'utf8')
    await expect(readProfile()).resolves.toEqual(EMPTY_PROFILE)
  })

  it('limpa o que veio de um catálogo antigo', async () => {
    await writeFile(
      file(),
      JSON.stringify({
        selected: ['vim', 'programa-que-nao-existe'],
        drives: { vim: 'D:', 'programa-que-nao-existe': 'E:' },
        settings: { 'programa-que-nao-existe': { autostart: true } },
      }),
      'utf8',
    )

    await expect(readProfile()).resolves.toEqual({
      selected: ['vim'],
      drives: { vim: 'D:' },
      settings: {},
    })
  })
})

describe('writeProfile', () => {
  it('grava e lê de volta a mesma coisa', async () => {
    const escrito = await writeProfile({
      selected: ['vim', 'go'],
      drives: { vim: 'D:' },
      settings: { vim: { autostart: false } },
    })

    forgetProfile()
    await expect(readProfile()).resolves.toEqual(escrito)
  })

  it('grava json legível', async () => {
    await writeProfile({ selected: ['vim'], drives: {}, settings: {} })
    const bruto = await readFile(file(), 'utf8')
    expect(bruto).toContain('\n')
    expect(JSON.parse(bruto)).toEqual({ selected: ['vim'], drives: {}, settings: {} })
  })

  it('não deixa passar programa fora do catálogo', async () => {
    const escrito = await writeProfile({
      selected: ['programa-que-nao-existe'],
      drives: {},
      settings: {},
    })
    expect(escrito).toEqual(EMPTY_PROFILE)
  })

  it('não deixa passar ajuste vazio', async () => {
    const escrito = await writeProfile({
      selected: [],
      drives: {},
      settings: { vim: { extensions: [] } },
    })
    expect(escrito.settings).toEqual({})
  })

  it('sobrescreve em vez de mesclar', async () => {
    await writeProfile({ selected: ['vim', 'go'], drives: {}, settings: {} })
    const segundo = await writeProfile({ selected: ['go'], drives: {}, settings: {} })
    expect(segundo.selected).toEqual(['go'])

    forgetProfile()
    await expect(readProfile()).resolves.toEqual(segundo)
  })
})
