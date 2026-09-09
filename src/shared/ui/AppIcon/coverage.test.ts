import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILTIN_PROGRAMS } from '@shared/domain/catalog'
import { TINTS } from './tints'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', '..', 'assets', 'icons')
const logosDir = join(here, '..', '..', 'assets', 'logos')

const files = readdirSync(iconsDir).filter((name) => name.endsWith('.svg'))
const logos = readdirSync(logosDir).filter((name) => name.endsWith('.svg'))
const withIcon = new Set([...files, ...logos].map((name) => name.replace(/\.svg$/, '')))
const ids = BUILTIN_PROGRAMS.map((p) => p.id)

const awaiting: string[] = JSON.parse(readFileSync(join(iconsDir, 'awaiting.json'), 'utf8')).ids

describe('ícone de cada programa do catálogo', () => {
  it('só fica sem ícone quem está na lista de espera', () => {
    const semIcone = ids.filter((id) => !withIcon.has(id))
    expect(semIcone.sort()).toEqual([...awaiting].sort())
  })

  it('quem já ganhou ícone sai da lista de espera', () => {
    const jaTem = awaiting.filter((id) => withIcon.has(id))
    expect(jaTem).toEqual([])
  })

  it('a lista de espera não guarda programa que saiu do catálogo', () => {
    const sumiu = awaiting.filter((id) => !ids.includes(id))
    expect(sumiu).toEqual([])
  })

  it('todo programa tem cor, mesmo o que ainda mostra o monograma', () => {
    const semTint = ids.filter((id) => !TINTS[id])
    expect(semTint).toEqual([])
  })

  it('não sobra ícone de programa que saiu do catálogo', () => {
    const orfaos = [...withIcon].filter((id) => !ids.includes(id))
    expect(orfaos).toEqual([])
  })

  it('todo ícone tem viewBox, e não é comprido a ponto de sumir na máscara', () => {
    for (const name of files) {
      const svg = readFileSync(join(iconsDir, name), 'utf8')
      const box = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1]?.trim().split(/\s+/)
      expect(box, name).toHaveLength(4)

      const width = Number(box?.[2])
      const height = Number(box?.[3])
      expect(width, name).toBeGreaterThan(0)
      expect(height, name).toBeGreaterThan(0)
      expect(width / height, name).toBeGreaterThan(0.5)
      expect(width / height, name).toBeLessThan(2)
    }
  })
})

describe('logotipo colorido', () => {
  it('não repete quem já tem silhueta, senão os dois disputariam o mesmo id', () => {
    const nasDuas = logos
      .map((name) => name.replace(/\.svg$/, ''))
      .filter((id) => files.includes(`${id}.svg`))

    expect(nasDuas).toEqual([])
  })
})
