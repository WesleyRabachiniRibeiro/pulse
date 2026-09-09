import { afterEach, describe, expect, it } from 'vitest'
import {
  BUILTIN_CATALOG,
  BUILTIN_PROGRAMS,
  bundleIsActive,
  catalogSchema,
  entryMatchesProgram,
  estimatedMinutes,
  EVERYTHING_BUNDLE,
  filterCatalog,
  formatMb,
  getBundles,
  getCategories,
  getProgram,
  getPrograms,
  groupByCategory,
  hasProgram,
  installedIds,
  nameMatchesProgram,
  readVersionFromSearch,
  resetCatalog,
  setCatalog,
  sortVersions,
  totalSizeMb,
  type Catalog,
  type PackageVersion,
} from './catalog'

afterEach(resetCatalog)

function version(winget: string, name = winget, raw = '1.0'): PackageVersion {
  return { winget, name, version: raw, recommended: false }
}

describe('catálogo', () => {
  it('não tem id repetido', () => {
    expect(new Set(getPrograms().map((p) => p.id)).size).toBe(getPrograms().length)
  })

  it('tem winget ou é página', () => {
    for (const program of getPrograms()) {
      expect(Boolean(program.winget) || program.source === 'pages').toBe(true)
    }
  })

  it('só monta pacotes que existem nos combos', () => {
    for (const bundle of getBundles()) {
      for (const id of bundle.ids) expect(hasProgram(id)).toBe(true)
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
  const chrome = getProgram('chrome')
  const teams = getProgram('teams')

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
    const chrome = getProgram('chrome')?.mb ?? 0
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
    expect(filterCatalog('  ')).toHaveLength(getPrograms().length)
  })

  it('agrupa sem categoria vazia', () => {
    const groups = groupByCategory(filterCatalog('chrome'))
    expect(groups.every((g) => g.programs.length > 0)).toBe(true)
  })
})

describe('bundleIsActive', () => {
  const essencial = getBundles().find((b) => b.name === 'Essencial')

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

describe('registro do catálogo', () => {
  const other: Catalog = {
    version: 1,
    categories: [{ id: 'tools', name: 'FERRAMENTAS' }],
    programs: [
      {
        id: 'sete-zip',
        name: '7-Zip',
        winget: '7zip.7zip',
        version: '26.02',
        mb: 5,
        category: 'tools',
        hints: ['7-zip'],
      },
    ],
    bundles: [{ name: 'Compactar', ids: ['sete-zip'] }],
  }

  it('troca o catálogo inteiro', () => {
    setCatalog(other)
    expect(getPrograms().map((p) => p.id)).toEqual(['sete-zip'])
    expect(getCategories().map((c) => c.id)).toEqual(['tools'])
    expect(hasProgram('chrome')).toBe(false)
    expect(getProgram('sete-zip')?.name).toBe('7-Zip')
  })

  it('volta para o embutido', () => {
    setCatalog(other)
    resetCatalog()
    expect(hasProgram('chrome')).toBe(true)
  })

  it('descarta programa de categoria que não existe', () => {
    setCatalog({
      ...other,
      programs: [
        ...other.programs,
        { id: 'orfao', name: 'Órfão', winget: 'x.y', version: '1', mb: 1, category: 'sumiu', hints: [] },
      ],
    })
    expect(getPrograms().map((p) => p.id)).toEqual(['sete-zip'])
  })

  it('sempre monta o combo Tudo com o catálogo vigente', () => {
    setCatalog(other)
    const tudo = getBundles().find((b) => b.name === EVERYTHING_BUNDLE)
    expect(tudo?.ids).toEqual(['sete-zip'])
  })

  it('tira do combo o id que não existe mais', () => {
    setCatalog({ ...other, bundles: [{ name: 'Compactar', ids: ['sete-zip', 'sumiu'] }] })
    expect(getBundles().find((b) => b.name === 'Compactar')?.ids).toEqual(['sete-zip'])
  })

  it('descarta combo que ficou sem nenhum programa', () => {
    setCatalog({ ...other, bundles: [{ name: 'Vazio', ids: ['sumiu'] }] })
    expect(getBundles().map((b) => b.name)).toEqual([EVERYTHING_BUNDLE])
  })

  it('a busca e o agrupamento seguem o catálogo trocado', () => {
    setCatalog(other)
    expect(filterCatalog('ferramentas').map((p) => p.id)).toEqual(['sete-zip'])
    expect(groupByCategory(getPrograms()).map((g) => g.category.id)).toEqual(['tools'])
  })

  it('installedIds passa a reconhecer o catálogo trocado', () => {
    setCatalog(other)
    expect(installedIds(['7-Zip 26.02 (x64)'])).toEqual(['sete-zip'])
    expect(installedIds(['Google Chrome'])).toEqual([])
  })
})

describe('catalogSchema', () => {
  it('aceita o catálogo embutido', () => {
    expect(catalogSchema.safeParse(BUILTIN_CATALOG).success).toBe(true)
  })

  it('recusa versão de formato desconhecida', () => {
    expect(catalogSchema.safeParse({ ...BUILTIN_CATALOG, version: 2 }).success).toBe(false)
  })

  it('recusa catálogo sem programa', () => {
    expect(catalogSchema.safeParse({ ...BUILTIN_CATALOG, programs: [] }).success).toBe(false)
  })

  it('recusa catálogo sem categoria', () => {
    expect(catalogSchema.safeParse({ ...BUILTIN_CATALOG, categories: [] }).success).toBe(false)
  })

  it('recusa programa sem id', () => {
    expect(
      catalogSchema.safeParse({
        ...BUILTIN_CATALOG,
        programs: [{ name: 'X', version: '1', mb: 1, category: 'dev', hints: [] }],
      }).success,
    ).toBe(false)
  })

  it('recusa settingsKind inventado', () => {
    expect(
      catalogSchema.safeParse({
        ...BUILTIN_CATALOG,
        programs: [
          { id: 'x', name: 'X', version: '1', mb: 1, category: 'dev', hints: [], settingsKind: 'inventado' },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('readVersionFromSearch', () => {
  const table = [
    'Nome ID      Versão',
    '---------------------',
    'Vim  vim.vim 9.2.1037',
  ].join('\n')

  it('lê a versão da linha do pacote', () => {
    expect(readVersionFromSearch(table, 'vim.vim')).toBe('9.2.1037')
  })

  it('não depende do idioma do cabeçalho', () => {
    const english = ['Name ID      Version', '--------------------', 'Vim  vim.vim 9.2.1037'].join('\n')
    expect(readVersionFromSearch(english, 'vim.vim')).toBe('9.2.1037')
  })

  it('não liga para maiúscula e minúscula no id', () => {
    expect(readVersionFromSearch(table, 'Vim.Vim')).toBe('9.2.1037')
  })

  it('devolve nulo quando o pacote não aparece', () => {
    expect(readVersionFromSearch(table, 'outro.pacote')).toBeNull()
  })

  it('devolve nulo quando a saída está vazia', () => {
    expect(readVersionFromSearch('', 'vim.vim')).toBeNull()
  })

  it('devolve nulo quando a versão é desconhecida', () => {
    const store = 'LinkedIn 9WZDNCRFJ4Q7 Unknown'
    expect(readVersionFromSearch(store, '9WZDNCRFJ4Q7')).toBeNull()
    expect(readVersionFromSearch('X 9WZDNCRFJ4Q7 Desconhecido', '9WZDNCRFJ4Q7')).toBeNull()
  })

  it('ignora a linha em que o id é a primeira coluna, que é cabeçalho ou lixo', () => {
    expect(readVersionFromSearch('vim.vim 9.2', 'vim.vim')).toBeNull()
  })

  it('devolve nulo quando não sobra nada depois do id', () => {
    expect(readVersionFromSearch('Vim vim.vim', 'vim.vim')).toBeNull()
  })
})

describe('família de versões', () => {
  const familias = BUILTIN_PROGRAMS.filter((p) => p.family)

  it('o padrão de cada família compila como expressão', () => {
    for (const program of familias) {
      expect(() => new RegExp(program.family!.pattern), program.id).not.toThrow()
    }
  })

  it('o pacote recomendado do programa casa com o próprio padrão', () => {
    for (const program of familias) {
      const aceita = new RegExp(program.family!.pattern)
      expect(aceita.test(program.winget ?? ''), program.id).toBe(true)
    }
  })

  it('o prefixo da busca é começo do pacote recomendado', () => {
    for (const program of familias) {
      expect(program.winget?.startsWith(program.family!.prefix), program.id).toBe(true)
    }
  })

  it('o padrão do .NET aceita as versões e recusa a prévia', () => {
    const dotnet = BUILTIN_PROGRAMS.find((p) => p.id === 'dotnet')
    const aceita = new RegExp(dotnet?.family?.pattern ?? '')

    expect(aceita.test('Microsoft.DotNet.SDK.8')).toBe(true)
    expect(aceita.test('Microsoft.DotNet.SDK.3_1')).toBe(true)
    expect(aceita.test('Microsoft.DotNet.SDK.Preview')).toBe(false)
  })

  it('o padrão do PostgreSQL aceita só o número da versão', () => {
    const postgres = BUILTIN_PROGRAMS.find((p) => p.id === 'postgresql')
    const aceita = new RegExp(postgres?.family?.pattern ?? '')

    expect(aceita.test('PostgreSQL.PostgreSQL.18')).toBe(true)
    expect(aceita.test('PostgreSQL.PostgreSQL.Beta')).toBe(false)
  })
})
