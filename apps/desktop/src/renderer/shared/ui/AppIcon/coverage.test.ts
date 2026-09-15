import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOG } from '@pulse/catalog-data'
import { TINTS } from './tints'

// Um programa entra no catálogo por uma linha de dados, e o desenho dele mora
// em outro lugar. Sem este teste, os 51 programas que entraram de uma vez
// apareceram todos com monograma cinza e ninguém soube até alguém olhar.
const here = dirname(fileURLToPath(import.meta.url))
const assets = join(here, '..', '..', 'assets')

function svgIds(folder: string): string[] {
  return readdirSync(join(assets, folder))
    .filter((name) => name.endsWith('.svg'))
    .map((name) => name.replace(/\.svg$/, ''))
}

const masks = svgIds('icons')
const logos = svgIds('logos')
const drawn = new Set([...masks, ...logos])
const ids = CATALOG.map((p) => p.id)

describe('desenho de cada programa do catálogo', () => {
  it('todo programa tem ícone', () => {
    expect(ids.filter((id) => !drawn.has(id))).toEqual([])
  })

  it('todo programa tem cor, que é o que tinge a silhueta', () => {
    expect(ids.filter((id) => TINTS[id] === undefined)).toEqual([])
  })

  // Ícone de programa que saiu do catálogo vira peso morto no bundle, e cor
  // sem dono engana quem procura de quem ela é.
  it('não sobra ícone nem cor de programa que não existe mais', () => {
    const known = new Set(ids)
    expect([...drawn].filter((id) => !known.has(id)).sort()).toEqual([])
    expect(Object.keys(TINTS).filter((id) => !known.has(id)).sort()).toEqual([])
  })

  // A máscara é tingida com a cor do programa; o logo tem cores próprias e vai
  // como imagem. Estar nas duas pastas deixaria a escolha ao acaso da ordem.
  it('nenhum programa está nas duas pastas ao mesmo tempo', () => {
    expect(masks.filter((id) => logos.includes(id))).toEqual([])
  })
})
