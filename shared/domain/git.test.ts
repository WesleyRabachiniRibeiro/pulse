import { describe, expect, it } from 'vitest'
import { DEFAULT_GIT, gitConfigPairs, gitIsEmpty, gitSchema, gitSummary, LINE_ENDINGS } from './git'

function config(extra: Partial<Parameters<typeof gitConfigPairs>[0]> = {}) {
  return { ...DEFAULT_GIT, ...extra }
}

function keys(pairs: [string, string][]): string[] {
  return pairs.map(([key]) => key)
}

describe('gitConfigPairs', () => {
  it('não escreve nada quando não há nada para escrever', () => {
    expect(gitConfigPairs(config({ branch: '' }))).toEqual([])
  })

  it('escreve nome e email quando existem', () => {
    const pairs = gitConfigPairs(config({ name: 'Wesley', email: 'a@b.c', branch: '' }))
    expect(pairs).toEqual([
      ['user.name', 'Wesley'],
      ['user.email', 'a@b.c'],
    ])
  })

  it('tira o espaço das pontas', () => {
    const pairs = gitConfigPairs(config({ name: '  Wesley  ', branch: '' }))
    expect(pairs[0]).toEqual(['user.name', 'Wesley'])
  })

  it('ignora campo que só tem espaço', () => {
    expect(gitConfigPairs(config({ name: '   ', branch: '   ' }))).toEqual([])
  })

  it('escreve o branch inicial', () => {
    expect(gitConfigPairs(config({ branch: 'main' }))).toEqual([['init.defaultBranch', 'main']])
  })

  it('escreve o fim de linha escolhido', () => {
    const pairs = gitConfigPairs(config({ branch: '', lineEnding: 'input' }))
    expect(pairs).toEqual([['core.autocrlf', 'input']])
  })

  it('escreve o rebase nos dois sentidos', () => {
    expect(gitConfigPairs(config({ branch: '', pullRebase: true }))).toEqual([
      ['pull.rebase', 'true'],
    ])
    expect(gitConfigPairs(config({ branch: '', pullRebase: false }))).toEqual([
      ['pull.rebase', 'false'],
    ])
  })

  it('liga o gerenciador de credenciais só quando pedido', () => {
    expect(keys(gitConfigPairs(config({ branch: '', saveLogin: true })))).toContain(
      'credential.helper',
    )
    expect(keys(gitConfigPairs(config({ branch: '', saveLogin: false })))).not.toContain(
      'credential.helper',
    )
  })

  it('a chave SSH não é config do git, então não entra aqui', () => {
    expect(gitConfigPairs(config({ branch: '', sshKey: true }))).toEqual([])
  })
})

describe('gitIsEmpty', () => {
  it('vazio quando não há config nenhuma', () => {
    expect(gitIsEmpty(undefined)).toBe(true)
    expect(gitIsEmpty(config({ branch: '' }))).toBe(true)
  })

  it('não vazio quando tem qualquer coisa para gravar', () => {
    expect(gitIsEmpty(config({ branch: 'main' }))).toBe(false)
    expect(gitIsEmpty(config({ branch: '', lineEnding: 'true' }))).toBe(false)
    expect(gitIsEmpty(config({ branch: '', pullRebase: false }))).toBe(false)
  })
})

describe('gitSummary', () => {
  it('fala em português de cada escolha', () => {
    expect(gitSummary(config({ name: 'Wesley' }))).toContain('Git configurado')
    expect(gitSummary(config({ pullRebase: true }))).toContain('pull com rebase')
    expect(gitSummary(config({ pullRebase: false }))).toContain('pull com merge')
    expect(gitSummary(config({ sshKey: true }))).toContain('chave SSH')
    expect(gitSummary(config({ saveLogin: true }))).toContain('login do GitHub guardado')
  })

  it('devolve vazio quando não há config', () => {
    expect(gitSummary(undefined)).toEqual([])
  })
})

describe('gitSchema', () => {
  it('aceita a config padrão', () => {
    expect(gitSchema.safeParse(DEFAULT_GIT).success).toBe(true)
  })

  it('recusa fim de linha inventado', () => {
    expect(gitSchema.safeParse({ ...DEFAULT_GIT, lineEnding: 'talvez' }).success).toBe(false)
  })

  it('aceita os três fins de linha que a tela oferece', () => {
    for (const choice of LINE_ENDINGS) {
      expect(gitSchema.safeParse({ ...DEFAULT_GIT, lineEnding: choice.id }).success).toBe(true)
    }
  })
})
