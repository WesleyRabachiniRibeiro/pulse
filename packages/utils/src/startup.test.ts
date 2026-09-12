import { describe, expect, it } from 'vitest'
import type { StartupEntry } from '@pulse/domain'
import { tidyStartup, withPrograms } from './startup'

function entry(name: string, over: Partial<StartupEntry> = {}): StartupEntry {
  return { name, value: '', enabled: true, ...over }
}

describe('entradas de inicialização', () => {
  // O mesmo programa costuma estar em HKCU e HKLM ao mesmo tempo.
  it('o mesmo nome não vira duas linhas', () => {
    const found = tidyStartup([entry('Steam'), entry('steam'), entry('STEAM')])
    expect(found).toHaveLength(1)
  })

  it('a lista sai em ordem que gente lê, sem ligar para maiúscula', () => {
    const found = tidyStartup([entry('zoom'), entry('Adobe'), entry('épico')])
    expect(found.map((e) => e.name)).toEqual(['Adobe', 'épico', 'zoom'])
  })

  it('entrada sem nome não entra', () => {
    expect(tidyStartup([entry('  '), entry('')])).toEqual([])
  })

  it('espaço em volta do nome é aparado', () => {
    expect(tidyStartup([entry('  Steam  ')])[0]?.name).toBe('Steam')
  })

  it('ligado e desligado sobrevivem à limpeza', () => {
    const found = tidyStartup([entry('A', { enabled: false }), entry('B', { enabled: true })])
    expect(found.map((e) => e.enabled)).toEqual([false, true])
  })

  it('o que casa com o catálogo ganha o id do programa', () => {
    const found = withPrograms([entry('Steam', { value: 'C:\Steam\steam.exe' })])
    expect(found[0]?.programId).toBe('steam')
  })

  // Programa que o Pulse não instalou é justamente o que mais interessa nesta
  // aba, então ele fica na lista, só sem ícone.
  it('o que não casa continua na lista, sem id', () => {
    const found = withPrograms([entry('Algum Programa Qualquer')])
    expect(found).toHaveLength(1)
    expect(found[0]?.programId).toBeUndefined()
  })
})
