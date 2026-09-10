import { describe, expect, it } from 'vitest'
import {
  alreadyInstalled,
  errorMessage,
  hex,
  installArgs,
  installerBusy,
  needsAdmin,
  needsReboot,
  noApplicableInstaller,
  refusedDrive,
  refusedElevation,
  refusesElevation,
  scopeLabel,
} from './winget'

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

describe('classificação da saída do winget', () => {
  it('reconhece que já estava instalado, por código ou por texto', () => {
    expect(alreadyInstalled(0x8a15002b, '')).toBe(true)
    expect(alreadyInstalled(1, 'No available upgrade found')).toBe(true)
    expect(alreadyInstalled(1, 'Nenhuma atualização disponível')).toBe(true)
    expect(alreadyInstalled(1, 'algo deu errado')).toBe(false)
  })

  it('reconhece falta de permissão de administrador', () => {
    expect(needsAdmin(5, '')).toBe(true)
    expect(needsAdmin(740, '')).toBe(true)
    expect(needsAdmin(0x80070005, '')).toBe(true)
    expect(needsAdmin(1, 'Acesso negado')).toBe(true)
    expect(needsAdmin(1, 'Access is denied')).toBe(true)
    expect(needsAdmin(1, 'tudo certo')).toBe(false)
  })

  it('reconhece a permissão recusada na janela do Windows', () => {
    expect(refusedElevation(1223)).toBe(true)
    expect(refusedElevation(0x800704c7)).toBe(true)
    expect(refusedElevation(1)).toBe(false)
  })

  it('reconhece pedido de reinício', () => {
    expect(needsReboot(3010, '')).toBe(true)
    expect(needsReboot(1641, '')).toBe(true)
    expect(needsReboot(1, 'Restart required')).toBe(true)
    expect(needsReboot(1, 'Reinicie o computador')).toBe(true)
    expect(needsReboot(0, 'terminou')).toBe(false)
  })

  it('reconhece outro instalador em andamento', () => {
    expect(installerBusy(1618, '')).toBe(true)
    expect(installerBusy(1, 'Another installation is in progress')).toBe(true)
    expect(installerBusy(1, 'Outra instalação está em andamento')).toBe(true)
    expect(installerBusy(1, 'nada a ver')).toBe(false)
  })

  it('reconhece recusa do local de instalação', () => {
    expect(refusedDrive('the installer does not support location')).toBe(true)
    expect(refusedDrive('local de instalação inválido')).toBe(true)
    expect(refusedDrive('outro erro')).toBe(false)
  })

  it('reconhece instalador que não roda elevado', () => {
    expect(refusesElevation('cannot run in administrator context')).toBe(true)
    expect(refusesElevation('não roda em contexto de administrador')).toBe(true)
    expect(refusesElevation('qualquer coisa')).toBe(false)
  })

  it('formata o código em hexadecimal, inclusive negativo', () => {
    expect(hex(5)).toBe('0x5')
    expect(hex(-2147024891)).toBe('0x80070005')
  })

  it('a mensagem escolhe a causa mais específica primeiro', () => {
    expect(errorMessage(1223, 'administrator context', 'Node')).toContain('não roda com o Pulse')
    expect(errorMessage(1223, '', 'Node')).toContain('foi recusada')
    expect(errorMessage(5, '', 'Node')).toContain('Conceder permissão')
  })

  it('a mensagem genérica leva o código e a última linha da saída', () => {
    const said = errorMessage(1, 'primeira\n\nfoi mal, deu ruim', 'Node')
    expect(said).toContain('0x1')
    expect(said).toContain('foi mal, deu ruim')
  })

  it('a mensagem genérica sobrevive a saída vazia', () => {
    expect(errorMessage(1, '', 'Node')).toBe('O winget encerrou com 0x1.')
  })
})
