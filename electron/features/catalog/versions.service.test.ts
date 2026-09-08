import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Program } from '@shared/domain/catalog'

let userData = ''
const asked: string[] = []
let answer: (id: string) => string = () => ''

vi.mock('electron', () => ({
  app: { getPath: (): string => userData },
}))

vi.mock('node:child_process', () => ({
  execFile: (
    _command: string,
    args: readonly string[],
    _options: unknown,
    done: (error: Error | null, result: { stdout: string; stderr: string }) => void,
  ): void => {
    const id = args[args.indexOf('--id') + 1] ?? ''
    asked.push(id)
    done(null, { stdout: answer(id), stderr: '' })
  },
}))

const { asksWinget, forgetVersions, knownVersions, refreshVersions } = await import(
  './versions.service'
)

function program(id: string, extra: Partial<Program> = {}): Program {
  return {
    id,
    name: id,
    winget: `pkg.${id}`,
    version: '0.0',
    mb: 1,
    category: 'dev',
    hints: [id],
    ...extra,
  }
}

function file(): string {
  return join(userData, 'versions.json')
}

function table(id: string, version: string): string {
  return `Nome ID Versão\n------\nNome ${id} ${version}`
}

beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'pulse-versions-'))
  asked.length = 0
  answer = (id) => table(id, '9.9.9')
  forgetVersions()
})

afterEach(async () => {
  await rm(userData, { recursive: true, force: true })
})

describe('asksWinget', () => {
  it('aceita programa comum', () => {
    expect(asksWinget(program('vim'))).toBe(true)
  })

  it('pula a Store, que não informa versão', () => {
    expect(asksWinget(program('linkedin', { source: 'msstore' }))).toBe(false)
  })

  it('pula quem só abre uma página', () => {
    expect(asksWinget(program('tibia', { source: 'pages', winget: undefined }))).toBe(false)
  })

  it('pula quem não tem pacote', () => {
    expect(asksWinget(program('x', { winget: undefined }))).toBe(false)
  })
})

describe('refreshVersions', () => {
  it('pergunta ao winget e devolve o que achou', async () => {
    const found = await refreshVersions([program('vim'), program('go')])
    expect(found).toEqual({ vim: '9.9.9', go: '9.9.9' })
    expect(asked.sort()).toEqual(['pkg.go', 'pkg.vim'])
  })

  it('não pergunta por quem não usa o winget', async () => {
    await refreshVersions([program('linkedin', { source: 'msstore' })])
    expect(asked).toEqual([])
  })

  it('grava o resultado em disco', async () => {
    await refreshVersions([program('vim')])
    const gravado: unknown = JSON.parse(await readFile(file(), 'utf8'))
    expect(gravado).toMatchObject({ versions: { vim: '9.9.9' } })
  })

  it('deixa de fora quem o winget não soube responder', async () => {
    answer = (id) => (id === 'pkg.vim' ? table(id, '9.9.9') : '')
    const found = await refreshVersions([program('vim'), program('go')])
    expect(found).toEqual({ vim: '9.9.9' })
  })

  it('devolve nulo quando ninguém respondeu, sem gravar nada', async () => {
    answer = () => ''
    await expect(refreshVersions([program('vim')])).resolves.toBeNull()
    await expect(readFile(file(), 'utf8')).rejects.toThrow()
  })

  it('não repete a varredura enquanto o cache é recente', async () => {
    await refreshVersions([program('vim')])
    forgetVersions()
    asked.length = 0

    await expect(refreshVersions([program('vim')])).resolves.toBeNull()
    expect(asked).toEqual([])
  })

  it('varre de novo quando o cache está velho', async () => {
    const antigo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await writeFile(file(), JSON.stringify({ at: antigo, versions: { vim: '1.0' } }), 'utf8')

    const found = await refreshVersions([program('vim')])
    expect(found).toEqual({ vim: '9.9.9' })
  })

  it('varre de novo quando o cache está corrompido', async () => {
    await writeFile(file(), 'não é json', 'utf8')
    await expect(refreshVersions([program('vim')])).resolves.toEqual({ vim: '9.9.9' })
  })
})

describe('knownVersions', () => {
  it('devolve vazio quando não há nada guardado', async () => {
    await expect(knownVersions()).resolves.toEqual({})
  })

  it('devolve o que foi guardado antes', async () => {
    await writeFile(
      file(),
      JSON.stringify({ at: new Date().toISOString(), versions: { vim: '9.2' } }),
      'utf8',
    )
    await expect(knownVersions()).resolves.toEqual({ vim: '9.2' })
  })
})
