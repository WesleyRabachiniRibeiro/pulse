import { describe, expect, it } from 'vitest'
import { getProgram, getPrograms } from './catalog'
import {
  buildInventory,
  catalogued,
  EMPTY_INVENTORY,
  inventorySchema,
  readUpgrades,
  strangers,
  upgradeFor,
} from './inventory'

const TABLE = [
  'Nome                                                    ID                               Versão             Disponível         Origem',
  '-------------------------------------------------------------------------------------------------------------------------------------',
  'blender                                                 BlenderFoundation.Blender        4.1.1              5.2.1              winget',
  'Go Programming Language amd64 go1.23.1                  GoLang.Go                        1.23.1             1.27.0             winget',
  'Krita (x64) 5.2.3 (git 68d178c)                         KDE.Krita                        5.2.3.100          5.3.3.0            winget',
  'Microsoft .NET SDK 8.0.319 (x64)                        Microsoft.DotNet.SDK.8           8.0.319            8.0.425            winget',
  'Eclipse Temurin JDK with Hotspot 25.0.1+8 (x64)         EclipseAdoptium.Temurin.25.JDK   25.0.1.8           25.0.4.101         winget',
  'Unity Hub 3.8.0                                         Unity.UnityHub                   < 3.21.0.65535     3.21.1.65535       winget',
  'Zoom Workplace                                          Zoom.Zoom.EXE                    7.0.6 (43848)      7.1.8 (46825)      winget',
].join('\n')

describe('readUpgrades', () => {
  it('lê cada linha da tabela do winget', () => {
    expect(readUpgrades(TABLE)).toHaveLength(7)
  })

  it('separa nome, identificador e as duas versões', () => {
    const blender = readUpgrades(TABLE)[0]
    expect(blender).toEqual({
      wingetId: 'BlenderFoundation.Blender',
      name: 'blender',
      current: '4.1.1',
      available: '5.2.1',
    })
  })

  it('não confunde versão dentro do nome com o identificador', () => {
    const go = readUpgrades(TABLE).find((u) => u.name.startsWith('Go Programming'))
    expect(go?.wingetId).toBe('GoLang.Go')
    expect(go?.current).toBe('1.23.1')
  })

  it('aguenta nome com parêntese e hash no meio', () => {
    const krita = readUpgrades(TABLE).find((u) => u.wingetId === 'KDE.Krita')
    expect(krita?.name).toBe('Krita (x64) 5.2.3 (git 68d178c)')
    expect(krita?.available).toBe('5.3.3.0')
  })

  it('não trata .NET como identificador', () => {
    const dotnet = readUpgrades(TABLE).find((u) => u.wingetId === 'Microsoft.DotNet.SDK.8')
    expect(dotnet?.name).toBe('Microsoft .NET SDK 8.0.319 (x64)')
  })

  it('aguenta versão com sinal de mais no nome', () => {
    const jdk = readUpgrades(TABLE).find((u) => u.wingetId === 'EclipseAdoptium.Temurin.25.JDK')
    expect(jdk?.current).toBe('25.0.1.8')
  })

  it('pula cabeçalho e linha de traços', () => {
    for (const u of readUpgrades(TABLE)) expect(u.name).not.toContain('---')
  })

  it('prefere um identificador que já conhece', () => {
    const linha = 'Coisa qualquer1.2 Fabricante.Coisa 1.0 2.0 winget'
    expect(readUpgrades(linha, ['Fabricante.Coisa'])[0]?.wingetId).toBe('Fabricante.Coisa')
  })

  it('não repete o mesmo identificador', () => {
    expect(readUpgrades(`${TABLE}\n${TABLE}`)).toHaveLength(7)
  })

  it('aguenta versão com espaço dentro', () => {
    const zoom = readUpgrades(TABLE).find((u) => u.wingetId === 'Zoom.Zoom.EXE')
    expect(zoom?.current).toBe('7.0.6 (43848)')
    expect(zoom?.available).toBe('7.1.8 (46825)')
  })

  it('aguenta versão que o winget marca como menor que', () => {
    const unity = readUpgrades(TABLE).find((u) => u.wingetId === 'Unity.UnityHub')
    expect(unity?.current).toBe('< 3.21.0.65535')
    expect(unity?.available).toBe('3.21.1.65535')
    expect(unity?.name).toBe('Unity Hub 3.8.0')
  })

  it('devolve vazio para saída vazia ou sem tabela', () => {
    expect(readUpgrades('')).toEqual([])
    expect(readUpgrades('Nenhum pacote instalado tem atualização.')).toEqual([])
  })
})

describe('buildInventory', () => {
  const programs = getPrograms()
  const agora = '2026-09-09T00:00:00.000Z'

  it('reconhece pelo nome quem está no catálogo', () => {
    const inv = buildInventory(
      { names: ['Google Chrome'], wingetIds: [], upgrades: [], programs },
      agora,
    )
    expect(inv.apps[0]?.programId).toBe('chrome')
  })

  it('guarda quem não está no catálogo, em vez de descartar', () => {
    const inv = buildInventory(
      { names: ['Programa Que Ninguém Conhece'], wingetIds: [], upgrades: [], programs },
      agora,
    )
    expect(inv.apps[0]).toEqual({ name: 'Programa Que Ninguém Conhece' })
  })

  it('marca como gerenciável quem o winget também conhece', () => {
    const chrome = getProgram('chrome')
    const inv = buildInventory(
      { names: ['Google Chrome'], wingetIds: [chrome?.winget ?? ''], upgrades: [], programs },
      agora,
    )
    expect(inv.apps[0]?.wingetId).toBe(chrome?.winget)
  })

  it('não marca como gerenciável quem o winget não listou', () => {
    const inv = buildInventory(
      { names: ['Google Chrome'], wingetIds: ['Outro.Pacote'], upgrades: [], programs },
      agora,
    )
    expect(inv.apps[0]?.wingetId).toBeUndefined()
  })

  it('tira nome repetido, sem ligar para maiúscula', () => {
    const inv = buildInventory(
      { names: ['Google Chrome', 'GOOGLE CHROME', '  '], wingetIds: [], upgrades: [], programs },
      agora,
    )
    expect(inv.apps).toHaveLength(1)
  })

  it('ordena por nome, do jeito do português', () => {
    const inv = buildInventory(
      { names: ['Zoom', 'Ámbar', 'Blender'], wingetIds: [], upgrades: [], programs },
      agora,
    )
    expect(inv.apps.map((a) => a.name)).toEqual(['Ámbar', 'Blender', 'Zoom'])
  })

  it('escolhe o programa da pista mais longa', () => {
    const inv = buildInventory(
      { names: ['Claude Code'], wingetIds: [], upgrades: [], programs },
      agora,
    )
    expect(inv.apps[0]?.programId).toBe('claudecode')
  })

  it('carrega as atualizações junto e marca a hora da leitura', () => {
    const inv = buildInventory(
      { names: [], wingetIds: [], upgrades: readUpgrades(TABLE), programs },
      agora,
    )
    expect(inv.upgrades).toHaveLength(7)
    expect(inv.readAt).toBe(agora)
  })
})

describe('leitura do inventário', () => {
  const programs = getPrograms()
  const inv = buildInventory(
    {
      names: ['Google Chrome', 'Programa Estranho'],
      wingetIds: [],
      upgrades: readUpgrades(TABLE),
      programs,
    },
    '2026-09-09T00:00:00.000Z',
  )

  it('separa quem é do catálogo de quem não é', () => {
    expect(catalogued(inv).map((a) => a.name)).toEqual(['Google Chrome'])
    expect(strangers(inv).map((a) => a.name)).toEqual(['Programa Estranho'])
  })

  it('acha a atualização de um pacote, sem ligar para maiúscula', () => {
    expect(upgradeFor(inv, 'kde.krita')?.available).toBe('5.3.3.0')
    expect(upgradeFor(inv, 'nao.existe')).toBeUndefined()
  })
})

describe('inventorySchema', () => {
  it('aceita o inventário vazio', () => {
    expect(inventorySchema.safeParse(EMPTY_INVENTORY).success).toBe(true)
  })

  it('recusa formato estranho', () => {
    expect(inventorySchema.safeParse({ apps: 'nenhum' }).success).toBe(false)
    expect(inventorySchema.safeParse(null).success).toBe(false)
  })
})
