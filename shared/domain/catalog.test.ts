import { describe, expect, it } from 'vitest'
import {
  CATALOG,
  bundleIsActive,
  BUNDLES,
  entryMatchesProgram,
  estimatedMinutes,
  filterCatalog,
  formatMb,
  groupByCategory,
  installedIds,
  nameMatchesProgram,
  PROGRAM_BY_ID,
  sortVersions,
  totalSizeMb,
  type PackageVersion,
} from './catalog'

function version(winget: string, name = winget, raw = '1.0'): PackageVersion {
  return { winget, name, version: raw, recommended: false }
}

describe('catálogo', () => {
  it('não tem id repetido', () => {
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length)
  })

  it('tem winget ou é página', () => {
    for (const program of CATALOG) {
      expect(Boolean(program.winget) || program.source === 'pages').toBe(true)
    }
  })

  it('só monta pacotes que existem nos combos', () => {
    for (const bundle of BUNDLES) {
      for (const id of bundle.ids) expect(PROGRAM_BY_ID.has(id)).toBe(true)
    }
  })
})

describe('sortVersions', () => {
  it('põe a LTS na frente', () => {
    const ordered = sortVersions([version('OpenJS.NodeJS.20'), version('OpenJS.NodeJS.LTS')])
    expect(ordered[0]?.winget).toBe('OpenJS.NodeJS.LTS')
  })

  it('ordena do maior para o menor pelo número no id', () => {
    const ordered = sortVersions([
      version('Python.Python.3.9'),
      version('Python.Python.3.13'),
      version('Python.Python.3.11'),
    ])
    expect(ordered.map((v) => v.winget)).toEqual([
      'Python.Python.3.13',
      'Python.Python.3.11',
      'Python.Python.3.9',
    ])
  })

  it('não mexe no array que recebeu', () => {
    const original = [version('Python.Python.3.9'), version('Python.Python.3.13')]
    sortVersions(original)
    expect(original[0]?.winget).toBe('Python.Python.3.9')
  })
})

describe('installedIds', () => {
  it('reconhece pelo nome que o Windows mostra', () => {
    expect(installedIds(['Google Chrome'])).toContain('chrome')
    expect(installedIds(['Microsoft Visual Studio Code (User)'])).toContain('vscode')
  })

  it('prefere a pista mais longa quando duas casam', () => {
    expect(installedIds(['Claude Code'])).toEqual(['claudecode'])
  })

  it('não casa por prefixo solto', () => {
    expect(installedIds(['Steamworks Common Redistributables'])).not.toContain('steam')
  })

  it('devolve vazio quando não conhece nada', () => {
    expect(installedIds(['Programa Qualquer 2000'])).toEqual([])
  })
})

describe('nameMatchesProgram e entryMatchesProgram', () => {
  const chrome = PROGRAM_BY_ID.get('chrome')
  const teams = PROGRAM_BY_ID.get('teams')

  it('casa o nome exato e o nome com sufixo', () => {
    expect(chrome && nameMatchesProgram('Google Chrome', chrome)).toBe(true)
    expect(chrome && nameMatchesProgram('Google Chrome (64 bits)', chrome)).toBe(true)
  })

  it('recusa nome que só compartilha o começo da palavra', () => {
    expect(chrome && nameMatchesProgram('Google Chromecast', chrome)).toBe(false)
  })

  it('ainda casa nome mais longo que começa igual, um falso positivo conhecido', () => {
    expect(chrome && nameMatchesProgram('Google Chrome Remote Desktop', chrome)).toBe(true)
  })

  it('casa entrada de inicialização ignorando pontuação', () => {
    expect(teams && entryMatchesProgram('MicrosoftTeams', 'ms-teams.exe', teams)).toBe(true)
  })
})

describe('tamanhos e busca', () => {
  it('soma só o que existe', () => {
    const chrome = PROGRAM_BY_ID.get('chrome')?.mb ?? 0
    expect(totalSizeMb(['chrome', 'nao-existe'])).toBe(chrome)
  })

  it('formata em MB e em GB', () => {
    expect(formatMb(500)).toBe('500 MB')
    expect(formatMb(2048)).toBe('2 GB')
  })

  it('nunca estima menos de dois minutos', () => {
    expect(estimatedMinutes(0)).toBe(2)
    expect(estimatedMinutes(900)).toBe(10)
  })

  it('busca por nome e por categoria, sem acento', () => {
    expect(filterCatalog('chrome').map((p) => p.id)).toContain('chrome')
    expect(filterCatalog('desenvolvimento').every((p) => p.category === 'dev')).toBe(true)
    expect(filterCatalog('  ')).toHaveLength(CATALOG.length)
  })

  it('agrupa sem categoria vazia', () => {
    const groups = groupByCategory(filterCatalog('chrome'))
    expect(groups.every((g) => g.programs.length > 0)).toBe(true)
  })
})

describe('bundleIsActive', () => {
  const essencial = BUNDLES.find((b) => b.name === 'Essencial')

  it('acende quando a seleção é exatamente o combo', () => {
    expect(essencial && bundleIsActive(essencial, new Set(essencial.ids))).toBe(true)
  })

  it('apaga quando sobra algo selecionado', () => {
    expect(essencial && bundleIsActive(essencial, new Set([...essencial.ids, 'vim']))).toBe(false)
  })

  it('ignora o que foi mandado ignorar', () => {
    if (!essencial) return
    const ignore = new Set([essencial.ids[0] as string])
    const selected = new Set(essencial.ids.slice(1))
    expect(bundleIsActive(essencial, selected, ignore)).toBe(true)
  })
})
