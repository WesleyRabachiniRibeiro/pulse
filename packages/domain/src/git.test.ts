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

  it('cada fim de linha vira o valor certo de core.autocrlf', () => {
    expect(pairsOf({ lineEnding: 'crlf' })['core.autocrlf']).toBe('true')
    expect(pairsOf({ lineEnding: 'lf' })['core.autocrlf']).toBe('input')
    expect(pairsOf({ lineEnding: 'keep' })['core.autocrlf']).toBe('false')
  })

  it('sem escolher fim de linha, o Pulse não mexe em core.autocrlf', () => {
    expect(pairsOf({})['core.autocrlf']).toBeUndefined()
  })

  it('pull.rebase grava os dois valores, e nada quando não foi tocado', () => {
    expect(pairsOf({ pullRebase: true })['pull.rebase']).toBe('true')
    expect(pairsOf({ pullRebase: false })['pull.rebase']).toBe('false')
    expect(pairsOf({})['pull.rebase']).toBeUndefined()
  })

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
