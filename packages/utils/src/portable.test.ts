import { describe, expect, it, vi } from 'vitest'
import { PROGRAM_BY_ID, type Program } from '@pulse/catalog-data'
import { EMPTY_PROFILE, PORTABLE_VERSION, readPortable, type Profile } from '@pulse/domain'
import {
  cleanProfile,
  csvOf,
  fileFor,
  missingFrom,
  portableOf,
  profileOf,
  scriptOf,
  wingetImportOf,
} from './portable'

const known = (id: string): boolean => ['chrome', 'firefox', 'steam'].includes(id)

const mine: Profile = {
  selected: ['chrome', 'steam'],
  drives: { steam: 'D:' },
  settings: { chrome: { steps: { browserDefault: { makeDefault: true } } } },
}

describe('exportar', () => {
  it('o arquivo do Pulse carrega versão, data e a seleção', () => {
    const portable = portableOf(mine, 'C:', new Date('2026-09-11T12:00:00Z'))

    expect(portable.pulse).toBe(PORTABLE_VERSION)
    expect(portable.savedAt).toBe('2026-09-11T12:00:00.000Z')
    expect(portable.programs).toEqual(['chrome', 'steam'])
    expect(portable.drive).toBe('C:')
  })

  it('o script usa CRLF, porque o destino é um PowerShell no Windows', () => {
    const text = scriptOf(['chrome'])
    expect(text).toContain('\r\n')
    expect(text).not.toMatch(/[^\r]\n/)
  })

  it('a planilha separa por ponto e vírgula', () => {
    const text = csvOf(['chrome'])
    expect(text.split('\r\n')[0]).toBe('nome;identificador;categoria;tamanho_mb')
  })

  it('id que não está no catálogo não vira linha nem pacote', () => {
    expect(csvOf(['inventado'])).toBe('nome;identificador;categoria;tamanho_mb\r\n')
    const list = JSON.parse(wingetImportOf(['inventado'])) as { Sources: { Packages: [] }[] }
    expect(list.Sources[0]?.Packages).toEqual([])
  })

  it('cada formato produz um arquivo diferente da mesma seleção', () => {
    const formats = (['pulse', 'winget', 'script', 'csv'] as const).map((f) => fileFor(f, mine))
    expect(new Set(formats).size).toBe(4)
  })
})

describe('importar', () => {
  const portable = portableOf(mine, 'C:')

  it('arquivo de outra versão do formato é recusado inteiro', () => {
    expect(readPortable({ ...portable, pulse: 99 })).toBeNull()
    expect(readPortable({ nada: true })).toBeNull()
    expect(readPortable(portable)).not.toBeNull()
  })

  it('juntar soma ao que já estava, sem repetir', () => {
    const current: Profile = { ...EMPTY_PROFILE, selected: ['firefox', 'chrome'] }
    expect(profileOf(portable, 'merge', current).selected).toEqual(['firefox', 'chrome', 'steam'])
  })

  it('substituir descarta o que estava', () => {
    const current: Profile = { ...EMPTY_PROFILE, selected: ['firefox'] }
    expect(profileOf(portable, 'replace', current).selected).toEqual(['chrome', 'steam'])
  })

  // Um perfil de outro PC pode citar programa que saiu do catálogo. Ele não
  // entra, mas a pessoa precisa saber o que ficou de fora.
  it('o que não existe aqui é descartado e relatado', () => {
    const vindo: Profile = {
      selected: ['chrome', 'aposentado'],
      drives: { aposentado: 'D:', chrome: '  ' },
      settings: { aposentado: { autostart: true }, firefox: {} },
    }

    const limpo = cleanProfile(vindo, known)

    expect(limpo.selected).toEqual(['chrome'])
    expect(limpo.drives).toEqual({})
    expect(limpo.settings).toEqual({})
    expect(missingFrom(vindo, known)).toEqual(['aposentado'])
  })
})

// O catálogo é versionado hoje, mas vai passar a aceitar programa vindo de
// fora. Um identificador que não parece identificador não pode virar linha de
// comando, nem no script nem na lista do winget.
describe('identificador vindo de fora', () => {
  const evil: readonly string[] = [
    "Pacote.Falso'; Remove-Item C:\\ -Recurse",
    'Pacote.Falso\nwinget install --id Outro',
    'Pacote.Falso & calc',
    'Pacote.Falso | Out-File x',
    '../../etc/passwd',
    '',
    '   ',
  ]

  it('nenhum deles chega ao script nem à lista do winget', () => {
    for (const winget of evil) {
      const forged = {
        id: 'forjado',
        name: 'Forjado',
        winget,
        version: '1',
        mb: 1,
        category: 'dev',
        hints: [],
      } as unknown as Program

      const get = vi.spyOn(PROGRAM_BY_ID, 'get').mockReturnValue(forged)

      const script = scriptOf(['forjado'])
      const commands = script.split('\r\n').filter((line) => line.startsWith('winget install'))
      const list = JSON.parse(wingetImportOf(['forjado'])) as { Sources: { Packages: [] }[] }

      expect(commands, winget).toEqual([])
      expect(list.Sources[0]?.Packages, winget).toEqual([])

      get.mockRestore()
    }
  })

  it('um identificador comum continua passando', () => {
    expect(scriptOf(['chrome'])).toContain('winget install --id Google.Chrome')
  })
})
