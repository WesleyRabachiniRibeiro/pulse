import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOG } from '@pulse/catalog-data'
import { TINTS } from './tints'

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

const awaiting: string[] = JSON.parse(
  readFileSync(join(assets, 'icons', 'awaiting.json'), 'utf8'),
).ids

describe('desenho de cada programa do catálogo', () => {
  it('só fica sem ícone quem está na lista de espera', () => {
    expect(ids.filter((id) => !drawn.has(id)).sort()).toEqual([...awaiting].sort())
  })

  it('quem ganhou ícone sai da lista de espera', () => {
    expect(awaiting.filter((id) => drawn.has(id))).toEqual([])
  })

  it('a lista de espera não guarda programa que saiu do catálogo', () => {
    expect(awaiting.filter((id) => !ids.includes(id))).toEqual([])
  })

  it('todo programa tem cor, que é o que tinge a silhueta', () => {
    expect(ids.filter((id) => TINTS[id] === undefined)).toEqual([])
  })

  it('não sobra ícone nem cor de programa que não existe mais', () => {
    const known = new Set(ids)
    expect([...drawn].filter((id) => !known.has(id)).sort()).toEqual([])
    expect(Object.keys(TINTS).filter((id) => !known.has(id)).sort()).toEqual([])
  })

  it('nenhum programa está nas duas pastas ao mesmo tempo', () => {
    expect(masks.filter((id) => logos.includes(id))).toEqual([])
  })
})
