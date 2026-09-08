import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILTIN_PROGRAMS } from '@shared/domain/catalog'
import { TINTS } from './tints'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', '..', 'assets', 'icons')

const files = readdirSync(iconsDir).filter((name) => name.endsWith('.svg'))
const withIcon = new Set(files.map((name) => name.replace(/\.svg$/, '')))
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

  it('todo ícone tem viewBox quadrado, que é o que a máscara precisa', async () => {
    const { readFile } = await import('node:fs/promises')

    for (const name of files) {
      const svg = await readFile(join(iconsDir, name), 'utf8')
      const box = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1]?.trim().split(/\s+/)
      expect(box, name).toHaveLength(4)
      expect(box?.[2], name).toBe(box?.[3])
    }
  })
})
