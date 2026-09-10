import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let home = ''
let toolExists = true
const calls: string[][] = []

vi.mock('node:os', async () => {
  const real = await vi.importActual<typeof import('node:os')>('node:os')
  return { ...real, homedir: (): string => home }
})

vi.mock('../toolchain', () => ({
  runTool: async (exe: string, args: readonly string[]): Promise<boolean> => {
    calls.push([exe, ...args])
    const target = args[args.indexOf('-f') + 1]
    if (!target) return false
    await writeFile(target, 'chave privada de mentira', 'utf8')
    await writeFile(`${target}.pub`, 'ssh-ed25519 AAAA-de-mentira teste', 'utf8')
    return true
  },
}))

const { ensureSshKey } = await import('./ssh')

function keyPath(): string {
  return join(home, '.ssh', 'id_ed25519')
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'pulse-ssh-'))
  calls.length = 0
  toolExists = true

  if (toolExists) {
    const openssh = join(home, 'System32', 'OpenSSH')
    await mkdir(openssh, { recursive: true })
    await writeFile(join(openssh, 'ssh-keygen.exe'), 'exe de mentira', 'utf8')
    process.env['SystemRoot'] = home
  }
  process.env['ProgramFiles'] = join(home, 'sem-git')
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('ensureSshKey', () => {
  it('cria a chave quando não existe e devolve a parte pública', async () => {
    const outcome = await ensureSshKey('wesley@exemplo.com')

    expect(outcome.result).toBe('created')
    expect(outcome.publicKey).toContain('ssh-ed25519')
  })

  it('usa ed25519 e não põe senha', async () => {
    await ensureSshKey('wesley@exemplo.com')

    const args = calls[0] ?? []
    expect(args).toContain('ed25519')
    expect(args[args.indexOf('-C') + 1]).toBe('wesley@exemplo.com')
    expect(args[args.indexOf('-N') + 1]).toBe('')
  })

  it('sem email, marca a chave como do Pulse', async () => {
    await ensureSshKey('   ')
    const args = calls[0] ?? []
    expect(args[args.indexOf('-C') + 1]).toBe('pulse')
  })

  it('não encosta na chave que já existe', async () => {
    await mkdir(join(home, '.ssh'), { recursive: true })
    await writeFile(keyPath(), 'a chave que já era sua', 'utf8')
    await writeFile(`${keyPath()}.pub`, 'ssh-ed25519 AAAA-antiga eu', 'utf8')

    const outcome = await ensureSshKey('wesley@exemplo.com')

    expect(outcome.result).toBe('existed')
    expect(outcome.publicKey).toContain('AAAA-antiga')
    expect(calls).toEqual([])
  })

  it('avisa quando não acha o ssh-keygen', async () => {
    process.env['SystemRoot'] = join(home, 'sem-openssh')
    process.env['ProgramFiles'] = join(home, 'sem-git')

    const outcome = await ensureSshKey('wesley@exemplo.com')

    expect(outcome.result).toBe('no-tool')
    expect(calls).toEqual([])
  })

  it('grava a chave dentro de .ssh na pasta do usuário', async () => {
    await ensureSshKey('wesley@exemplo.com')

    const args = calls[0] ?? []
    expect(args[args.indexOf('-f') + 1]).toBe(keyPath())
  })
})
