import { describe, expect, it } from 'vitest'
import { getPrograms } from './catalog'
import {
  buildInstalled,
  countNodes,
  filterInstalled,
  hiddenReason,
  iconPath,
  installedNodeSchema,
  selectable,
  stemOf,
  uninstallerFolder,
  uninstallerPath,
  type RegistryEntry,
} from './installed'

function entry(over: Partial<RegistryEntry> & { key: string; name: string }): RegistryEntry {
  return { uninstall: 'C:\\Programas\\Coisa\\uninstall.exe', ...over }
}

const STEAM = entry({ key: 'Steam', name: 'Steam', uninstall: 'D:\\Steam\\uninstall.exe' })

function steamGame(id: string, name: string): RegistryEntry {
  return entry({
    key: `Steam App ${id}`,
    name,
    uninstall: `"D:\\Steam\\steam.exe" steam://uninstall/${id}`,
  })
}

describe('hiddenReason', () => {
  it('esconde o que o próprio Windows esconde', () => {
    expect(hiddenReason(entry({ key: 'a', name: 'Microsoft .NET Host', system: true }))).toBe(
      'system',
    )
  })

  it('esconde atualização do Windows pelo número do KB', () => {
    const kb = entry({ key: 'b', name: 'Update for x64-based Windows Systems (KB5001716)' })
    expect(hiddenReason(kb)).toBe('update')
  })

  it('esconde o que não tem como desinstalar', () => {
    expect(hiddenReason({ key: 'c', name: 'Coisa presa' })).toBe('locked')
    expect(hiddenReason({ key: 'd', name: 'Coisa presa', uninstall: '   ' })).toBe('locked')
  })

  it('deixa passar programa comum', () => {
    expect(hiddenReason(entry({ key: 'e', name: 'Google Chrome' }))).toBeNull()
  })
})

describe('uninstallerPath', () => {
  it('lê o caminho entre aspas e ignora o resto da linha', () => {
    expect(uninstallerPath('"D:\\Steam\\steam.exe" steam://uninstall/105600')).toBe(
      'D:\\Steam\\steam.exe',
    )
  })

  it('lê caminho sem aspas, cortando no primeiro argumento', () => {
    expect(uninstallerPath('D:\\overwolf\\OWUninstaller.exe /S')).toBe(
      'D:\\overwolf\\OWUninstaller.exe',
    )
  })

  it('devolve nada quando a linha está vazia', () => {
    expect(uninstallerPath('   ')).toBeNull()
  })
})

describe('uninstallerFolder', () => {
  it('ignora o desinstalador que o Windows empresta para todo mundo', () => {
    const msi = entry({ key: 'f', name: 'Qualquer', uninstall: 'MsiExec.exe /X{1234}' })
    expect(uninstallerFolder(msi)).toBeNull()
  })

  it('ignora o que roda de dentro da pasta do Windows', () => {
    const sys = entry({ key: 'g', name: 'Coisa', uninstall: 'C:\\Windows\\System32\\algo.exe' })
    expect(uninstallerFolder(sys)).toBeNull()
  })

  it('normaliza barra invertida e maiúscula', () => {
    const misto = entry({ key: 'h', name: 'Coisa', uninstall: '"D:/Jogos//Coisa/x.exe" -q' })
    expect(uninstallerFolder(misto)).toBe('d:\\jogos\\coisa')
  })
})

describe('stemOf', () => {
  it('junta as versões do mesmo redistribuível', () => {
    const a = stemOf('Microsoft Visual C++ 2012 Redistributable (x64) - 11.0.60610')
    const b = stemOf('Microsoft Visual C++ v14 Redistributable (x86) - 14.51.36247')
    expect(a).toBe('Microsoft Visual C++ Redistributable')
    expect(b).toBe(a)
  })

  it('não junta produtos diferentes do mesmo fabricante', () => {
    expect(stemOf('Adobe Illustrator 2026')).not.toBe(stemOf('Adobe Premiere Pro 2026'))
  })

  it('não junta o programa com o acessório dele', () => {
    expect(stemOf('Python 3.12.6 (64-bit)')).not.toBe(stemOf('Python Launcher'))
  })
})

describe('buildInstalled', () => {
  const programs = getPrograms()

  it('conta o que escondeu em vez de fingir que não existe', () => {
    const tree = buildInstalled(
      [
        entry({ key: 'a', name: 'Google Chrome' }),
        entry({ key: 'b', name: 'Microsoft .NET Host', system: true }),
        { key: 'c', name: 'Coisa presa' },
      ],
      programs,
    )

    expect(tree.nodes).toHaveLength(1)
    expect(tree.hidden).toBe(2)
  })

  it('põe os jogos da Steam dentro da Steam, que é quem leva todos junto', () => {
    const tree = buildInstalled(
      [STEAM, steamGame('105600', 'Terraria'), steamGame('2357570', 'Overwatch')],
      programs,
    )

    expect(tree.nodes).toHaveLength(1)
    const steam = tree.nodes[0]
    expect(steam?.name).toBe('Steam')
    expect(steam?.kind).toBe('owner')
    expect(steam?.children.map((c) => c.name)).toEqual(['Overwatch', 'Terraria'])
  })

  it('reconhece o dono pela pasta de onde todo mundo desinstala', () => {
    const client = entry({
      key: 'Riot Game Riot_Client.',
      name: 'Riot Client ',
      uninstall: '"D:\\Riot Games\\Riot Client\\RiotClientServices.exe" --uninstall-product=x',
    })
    const valorant = entry({
      key: 'Riot Game valorant.live',
      name: 'VALORANT',
      uninstall: '"D:\\Riot Games\\Riot Client\\RiotClientServices.exe" --uninstall-product=v',
    })

    const tree = buildInstalled([client, valorant], programs)
    expect(tree.nodes[0]?.name).toBe('Riot Client')
    expect(tree.nodes[0]?.children.map((c) => c.name)).toEqual(['VALORANT'])
  })

  it('não agrupa quando ninguém do grupo é o dono', () => {
    const um = entry({
      key: 'ILST',
      name: 'Adobe Illustrator 2026',
      uninstall: '"C:\\Common\\Adobe\\HDBox\\Uninstaller.exe" --sapCode=ILST',
    })
    const dois = entry({
      key: 'PPRO',
      name: 'Adobe Premiere Pro 2026',
      uninstall: '"C:\\Common\\Adobe\\HDBox\\Uninstaller.exe" --sapCode=PPRO',
    })

    const tree = buildInstalled([um, dois], programs)
    expect(tree.nodes).toHaveLength(2)
    expect(tree.nodes.every((n) => n.kind === 'app')).toBe(true)
  })

  it('junta as versões do mesmo programa quando o fabricante é o mesmo', () => {
    const feito = (name: string, key: string): RegistryEntry =>
      entry({ key, name, publisher: 'Microsoft Corporation', uninstall: 'MsiExec.exe /X{' + key + '}' })

    const tree = buildInstalled(
      [
        feito('Microsoft Visual C++ 2012 Redistributable (x64) - 11.0.60610', '1'),
        feito('Microsoft Visual C++ 2013 Redistributable (x86) - 12.0.30501', '2'),
        feito('Microsoft Visual C++ v14 Redistributable (x64) - 14.51.36247', '3'),
      ],
      programs,
    )

    expect(tree.nodes).toHaveLength(1)
    expect(tree.nodes[0]?.kind).toBe('family')
    expect(tree.nodes[0]?.name).toBe('Microsoft Visual C++ Redistributable')
    expect(tree.nodes[0]?.children).toHaveLength(3)
  })

  it('não junta versões de fabricantes diferentes', () => {
    const oracle = entry({ key: '1', name: 'Java 8 Update 341', publisher: 'Oracle' })
    const eclipse = entry({ key: '2', name: 'Java 8 Update 999', publisher: 'Eclipse' })

    expect(buildInstalled([oracle, eclipse], programs).nodes).toHaveLength(2)
  })

  it('liga o item ao catálogo quando o nome casa', () => {
    const tree = buildInstalled([entry({ key: 'a', name: 'Google Chrome' })], programs)
    expect(tree.nodes[0]?.programId).toBe('chrome')
  })

  it('não repete a mesma chave do registro', () => {
    const tree = buildInstalled(
      [entry({ key: 'a', name: 'Google Chrome' }), entry({ key: 'a', name: 'Google Chrome' })],
      programs,
    )
    expect(tree.nodes).toHaveLength(1)
  })

  it('sai no formato que o contrato aceita', () => {
    const tree = buildInstalled([STEAM, steamGame('1', 'Terraria')], programs)
    expect(installedNodeSchema.safeParse(tree.nodes[0]).success).toBe(true)
  })

  it('conta pai e filho ao dizer o tamanho da lista', () => {
    const tree = buildInstalled([STEAM, steamGame('1', 'Terraria')], programs)
    expect(countNodes(tree.nodes)).toBe(2)
  })
})

describe('iconPath', () => {
  it('tira o índice do recurso colado no fim', () => {
    expect(iconPath('D:\\overwolf\\Overwolf.exe,0')).toBe('D:\\overwolf\\Overwolf.exe')
  })

  it('aceita índice negativo, que o Windows também usa', () => {
    expect(iconPath('C:\\app\\x.dll,-101')).toBe('C:\\app\\x.dll')
  })

  it('tira as aspas de fora', () => {
    expect(iconPath('"C:\\Arquivos\\Coisa\\x.ico"')).toBe('C:\\Arquivos\\Coisa\\x.ico')
  })

  it('deixa em paz o caminho que já está limpo', () => {
    expect(iconPath('D:\\Steam\\games\\a4ce.ico')).toBe('D:\\Steam\\games\\a4ce.ico')
  })

  it('devolve nada quando o programa não registrou ícone', () => {
    expect(iconPath(undefined)).toBeNull()
    expect(iconPath('  ')).toBeNull()
  })
})

describe('filterInstalled', () => {
  const programs = getPrograms()
  const tree = buildInstalled(
    [
      STEAM,
      steamGame('105600', 'Terraria'),
      entry({ key: 'chrome', name: 'Google Chrome' }),
      entry({ key: 'x', name: 'Programa Estranho' }),
    ],
    programs,
  )

  it('sem busca e sem filtro devolve tudo', () => {
    expect(filterInstalled(tree.nodes, '')).toHaveLength(3)
  })

  it('acha pelo nome, sem ligar para acento nem maiúscula', () => {
    expect(filterInstalled(tree.nodes, 'ESTRANHO').map((n) => n.name)).toEqual([
      'Programa Estranho',
    ])
  })

  it('alcança o que está dentro do grupo', () => {
    expect(filterInstalled(tree.nodes, 'terraria').map((n) => n.name)).toEqual(['Steam'])
  })

  it('separa quem o Pulse conhece de quem ele não conhece', () => {
    const conhecidos = filterInstalled(tree.nodes, '', 'pulse').map((n) => n.name)
    const estranhos = filterInstalled(tree.nodes, '', 'stranger').map((n) => n.name)

    expect(conhecidos).toContain('Google Chrome')
    expect(estranhos).toEqual(['Programa Estranho'])
  })

  it('busca e filtro valem juntos', () => {
    expect(filterInstalled(tree.nodes, 'chrome', 'stranger')).toHaveLength(0)
  })
})

describe('selectable', () => {
  it('só deixa marcar o que o Pulse sabe desinstalar', () => {
    const tree = buildInstalled(
      [entry({ key: 'a', name: 'Google Chrome' }), entry({ key: 'b', name: 'Coisa Estranha' })],
      getPrograms(),
    )

    expect(selectable(tree.nodes).map((n) => n.name)).toEqual(['Google Chrome'])
  })
})

describe('ícone do item', () => {
  it('leva para o nó o caminho que o programa registrou', () => {
    const tree = buildInstalled(
      [entry({ key: 'a', name: 'Coisa', icon: 'D:\Coisa\coisa.exe,0' })],
      getPrograms(),
    )

    expect(tree.nodes[0]?.icon).toBe('D:\Coisa\coisa.exe')
  })

  it('não inventa ícone quando o programa não registrou', () => {
    const tree = buildInstalled([entry({ key: 'a', name: 'Coisa' })], getPrograms())
    expect(tree.nodes[0]).not.toHaveProperty('icon')
  })
})
