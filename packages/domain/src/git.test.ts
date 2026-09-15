import { describe, expect, it } from 'vitest'
import { DEFAULT_GIT, gitConfigPairs, type GitConfig } from './git'

function pairsOf(config: Partial<GitConfig>): Record<string, string> {
  return Object.fromEntries(gitConfigPairs({ ...DEFAULT_GIT, ...config }))
}

describe('configuração do Git', () => {
  it('sem nada preenchido, não escreve nada além do branch padrão', () => {
    expect(gitConfigPairs({ name: '', email: '', branch: '' })).toEqual([])
  })

  it('nome e email em branco não viram par vazio', () => {
    const pairs = pairsOf({ name: '   ', email: '  ' })
    expect(pairs['user.name']).toBeUndefined()
    expect(pairs['user.email']).toBeUndefined()
  })

  // Os três valores de core.autocrlf não se chamam pelo que fazem, e trocar um
  // pelo outro é a diferença entre um diff limpo e um arquivo inteiro marcado.
  it('cada fim de linha vira o valor certo de core.autocrlf', () => {
    expect(pairsOf({ lineEnding: 'crlf' })['core.autocrlf']).toBe('true')
    expect(pairsOf({ lineEnding: 'lf' })['core.autocrlf']).toBe('input')
    expect(pairsOf({ lineEnding: 'keep' })['core.autocrlf']).toBe('false')
  })

  it('sem escolher fim de linha, o Pulse não mexe em core.autocrlf', () => {
    expect(pairsOf({})['core.autocrlf']).toBeUndefined()
  })

  // Desligar o rebase é um pedido tanto quanto ligar: o que significa "não
  // mexer" é o campo não ter sido tocado.
  it('pull.rebase grava os dois valores, e nada quando não foi tocado', () => {
    expect(pairsOf({ pullRebase: true })['pull.rebase']).toBe('true')
    expect(pairsOf({ pullRebase: false })['pull.rebase']).toBe('false')
    expect(pairsOf({})['pull.rebase']).toBeUndefined()
  })

  // A chave SSH é uma ação, não uma linha de configuração: ela não pode
  // aparecer no que vai para o `git config`.
  it('a chave SSH não vira par de configuração', () => {
    const pairs = pairsOf({ sshKey: true })
    expect(Object.keys(pairs)).not.toContain('sshKey')
    expect(Object.keys(pairs)).not.toContain('user.sshKey')
  })

  it('guardar o login liga o gerenciador de credenciais', () => {
    expect(pairsOf({ saveLogin: true })['credential.helper']).toBe('manager')
    expect(pairsOf({ saveLogin: false })['credential.helper']).toBeUndefined()
  })
})
