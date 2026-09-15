import { describe, expect, it } from 'vitest'
import { CATALOG } from '@pulse/catalog-data'
import type { RegistryEntry } from '@pulse/domain'
import {
  buildInstalled,
  countNodes,
  selectable,
  filterInstalled,
  hiddenReason,
  iconPath,
  stemOf,
  uninstallerFolder,
  uninstallerPath,
} from './installed'

function entry(over: Partial<RegistryEntry> & { name: string }): RegistryEntry {
  return { key: over.name, uninstall: 'C:\\App\\uninstall.exe', ...over }
}

describe('o que não é programa da pessoa', () => {
  it('componente de sistema, atualização do Windows e sem desinstalador ficam de fora', () => {
    expect(hiddenReason(entry({ name: 'Algo', system: true }))).toBe('system')
    expect(hiddenReason(entry({ name: 'Update for Windows (KB5034123)' }))).toBe('update')
    expect(hiddenReason(entry({ name: 'Algo', uninstall: '  ' }))).toBe('locked')
    expect(hiddenReason(entry({ name: 'Google Chrome' }))).toBeNull()
  })

  it('são contados, para a tela dizer quantos escondeu', () => {
    const { nodes, hidden } = buildInstalled(
      [entry({ name: 'Google Chrome' }), entry({ name: 'X', system: true }), entry({ name: 'Y', uninstall: '' })],
      CATALOG,
    )
    expect(hidden).toBe(2)
    expect(nodes).toHaveLength(1)
  })
})

describe('caminho do desinstalador', () => {
  it('pega o que está entre aspas', () => {
    expect(uninstallerPath('"C:\\Program Files\\App\\un.exe" /S')).toBe('C:\\Program Files\\App\\un.exe')
  })

  it('sem aspas, pega até o primeiro argumento', () => {
    expect(uninstallerPath('C:\\App\\un.exe /silent')).toBe('C:\\App\\un.exe')
    expect(uninstallerPath('C:\\App\\un.exe -q')).toBe('C:\\App\\un.exe')
  })

  // Vários programas usam o mesmo msiexec, então a pasta dele não diz nada
  // sobre quem instalou o quê e não pode agrupar.
  it('desinstalador compartilhado não vira pasta de agrupamento', () => {
    expect(uninstallerFolder(entry({ name: 'A', uninstall: 'MsiExec.exe /X{GUID}' }))).toBeNull()
    expect(uninstallerFolder(entry({ name: 'B', uninstall: 'C:\\Windows\\system32\\x.exe' }))).toBeNull()
  })

  it('desinstalador próprio devolve a pasta dele', () => {
    expect(uninstallerFolder(entry({ name: 'A', uninstall: '"C:\\App\\un.exe"' }))).toBe('c:\\app')
  })
})

describe('agrupamento', () => {
  // "Python 3.12 (64-bit)" e "Python 3.13" são o mesmo produto em versões
  // diferentes, e viram um grupo em vez de duas linhas soltas.
  it('tira versão e arquitetura para achar o produto', () => {
    expect(stemOf('Python 3.12.4 (64-bit)')).toBe('Python')
    expect(stemOf('Node.js v20.11.0')).toBe('Node.js')
  })

  it('versões do mesmo produto viram um grupo', () => {
    const { nodes } = buildInstalled(
      [
        entry({ name: 'Python 3.12 (64-bit)', key: 'a', publisher: 'PSF', uninstall: 'MsiExec.exe /X{1}' }),
        entry({ name: 'Python 3.13 (64-bit)', key: 'b', publisher: 'PSF', uninstall: 'MsiExec.exe /X{2}' }),
      ],
      CATALOG,
    )

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.kind).toBe('family')
    expect(nodes[0]?.children).toHaveLength(2)
  })

  it('produto de publicador diferente não entra no mesmo grupo', () => {
    const { nodes } = buildInstalled(
      [
        entry({ name: 'Editor 1.0', key: 'a', publisher: 'A', uninstall: 'MsiExec.exe /X{1}' }),
        entry({ name: 'Editor 2.0', key: 'b', publisher: 'B', uninstall: 'MsiExec.exe /X{2}' }),
      ],
      CATALOG,
    )
    expect(nodes).toHaveLength(2)
  })

  it('programa sozinho continua linha simples', () => {
    const { nodes } = buildInstalled([entry({ name: 'Google Chrome' })], CATALOG)
    expect(nodes[0]?.kind).toBe('app')
    expect(nodes[0]?.children).toEqual([])
  })

  it('o mesmo registro não aparece duas vezes', () => {
    const twice = entry({ name: 'Google Chrome', key: 'mesma' })
    expect(buildInstalled([twice, twice], CATALOG).nodes).toHaveLength(1)
  })
})

describe('reconhecer o catálogo', () => {
  it('o que o Pulse conhece ganha o id do programa', () => {
    const { nodes } = buildInstalled([entry({ name: 'Google Chrome' })], CATALOG)
    expect(nodes[0]?.programId).toBe('chrome')
  })

  it('o que ele não conhece continua na lista, sem id', () => {
    const { nodes } = buildInstalled([entry({ name: 'Programa Estranho Ltda' })], CATALOG)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.programId).toBeUndefined()
  })
})

describe('busca e filtro', () => {
  const { nodes } = buildInstalled(
    [entry({ name: 'Google Chrome' }), entry({ name: 'Programa Estranho', key: 'x' })],
    CATALOG,
  )

  it('separa o que o Pulse conhece do que não conhece', () => {
    expect(filterInstalled(nodes, '', 'pulse').map((n) => n.name)).toEqual(['Google Chrome'])
    expect(filterInstalled(nodes, '', 'stranger').map((n) => n.name)).toEqual(['Programa Estranho'])
    expect(filterInstalled(nodes, '', 'all')).toHaveLength(2)
  })

  it('busca ignora acento e maiúscula', () => {
    expect(filterInstalled(nodes, 'CHROME')).toHaveLength(1)
    expect(filterInstalled(nodes, 'estranho')).toHaveLength(1)
  })

  it('achar pelo nome de um filho mantém o grupo visível', () => {
    const grouped = buildInstalled(
      [
        entry({ name: 'Python 3.12', key: 'a', publisher: 'PSF', uninstall: 'MsiExec.exe /X{1}' }),
        entry({ name: 'Python 3.13', key: 'b', publisher: 'PSF', uninstall: 'MsiExec.exe /X{2}' }),
      ],
      CATALOG,
    ).nodes

    expect(filterInstalled(grouped, '3.13')).toHaveLength(1)
  })

  it('conta o grupo e os filhos', () => {
    expect(countNodes(nodes)).toBe(2)
  })
})

describe('ícone', () => {
  it('o índice depois da vírgula é descartado', () => {
    expect(iconPath('C:\\App\\app.exe,0')).toBe('C:\\App\\app.exe')
    expect(iconPath('"C:\\App\\app.exe",-1')).toBe('C:\\App\\app.exe')
    expect(iconPath(undefined)).toBeNull()
    expect(iconPath('  ')).toBeNull()
  })
})

describe('quem pode ser marcado', () => {
  it('só entra quem o catálogo reconhece', () => {
    const nodes = [
      { key: 'a', name: 'Steam', kind: 'app' as const, programId: 'steam', children: [] },
      { key: 'b', name: 'Coisa qualquer', kind: 'app' as const, children: [] },
    ]
    expect(selectable(nodes).map((n) => n.key)).toEqual(['a'])
  })

  it('lista vazia devolve vazia', () => {
    expect(selectable([])).toEqual([])
  })
})
