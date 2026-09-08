import { describe, expect, it } from 'vitest'
import { installArgs, noApplicableInstaller, scopeLabel } from './winget'

function argsFor(extra: Parameters<typeof installArgs>[0]): string[] {
  return installArgs(extra)
}

const base = { packageId: 'vim.vim' }

describe('installArgs', () => {
  it('monta o básico de sempre', () => {
    expect(argsFor(base)).toEqual([
      'install',
      '--id',
      'vim.vim',
      '--exact',
      '--accept-package-agreements',
      '--accept-source-agreements',
      '--disable-interactivity',
      '--silent',
    ])
  })

  it('põe o disco escolhido', () => {
    expect(argsFor({ ...base, destination: 'D:\\Pulse\\vim.vim' })).toContain('--location')
  })

  it('troca silencioso por interativo quando pedido', () => {
    const args = argsFor({ ...base, interactive: true })
    expect(args).toContain('--interactive')
    expect(args).not.toContain('--silent')
    expect(args).not.toContain('--disable-interactivity')
  })

  it('passa o escopo', () => {
    expect(argsFor({ ...base, scope: 'machine' })).toContain('machine')
    expect(argsFor({ ...base, scope: 'user' })).toContain('user')
  })

  it('passa o idioma', () => {
    const args = argsFor({ ...base, locale: 'pt-BR' })
    expect(args[args.indexOf('--locale') + 1]).toBe('pt-BR')
  })

  it('passa o caminho do log', () => {
    const args = argsFor({ ...base, logPath: 'C:\\logs\\vim.log' })
    expect(args[args.indexOf('--log') + 1]).toBe('C:\\logs\\vim.log')
  })

  it('não manda disco nem silencioso para a Store', () => {
    const args = argsFor({ ...base, source: 'msstore', destination: 'D:\\Pulse' })
    expect(args).toContain('msstore')
    expect(args).not.toContain('--location')
    expect(args).not.toContain('--silent')
  })

  it('leva escopo e idioma também na Store', () => {
    const args = argsFor({ ...base, source: 'msstore', scope: 'user', locale: 'pt-BR' })
    expect(args).toContain('--scope')
    expect(args).toContain('--locale')
  })

  it('override e disco não andam juntos', () => {
    const args = argsFor({ ...base, override: '--quiet --add X', destination: 'D:\\Pulse' })
    expect(args).toContain('--override')
    expect(args).not.toContain('--location')
    expect(args).not.toContain('--silent')
  })

  it('não inventa flag quando nada foi pedido', () => {
    const args = argsFor(base)
    for (const flag of ['--scope', '--locale', '--log', '--location', '--override']) {
      expect(args).not.toContain(flag)
    }
  })
})

describe('scopeLabel', () => {
  it('fala em português do escopo', () => {
    expect(scopeLabel('machine')).toBe('para todos os usuários')
    expect(scopeLabel('user')).toBe('só para você')
  })
})

describe('noApplicableInstaller', () => {
  it('reconhece a recusa em português, com e sem acento', () => {
    expect(noApplicableInstaller('Nenhum instalador aplicável foi encontrado')).toBe(true)
    expect(noApplicableInstaller('nenhum instalador aplicavel')).toBe(true)
  })

  it('reconhece a recusa em inglês', () => {
    expect(noApplicableInstaller('No applicable installer found')).toBe(true)
  })

  it('não confunde com outro erro', () => {
    expect(noApplicableInstaller('Acesso negado')).toBe(false)
    expect(noApplicableInstaller('')).toBe(false)
  })
})
