import { describe, expect, it } from 'vitest'
import {
  withExtras,
  filterCatalog,
  groupByCategory,
  installedIds,
  bundleIsActive,
  totalSizeMb,
  compareVersions,
} from './catalog'
import { SAMPLE_BUNDLES, SAMPLE_CATEGORIES, SAMPLE_PROGRAMS } from '@pulse/catalog-data/src/samples'
import { catalogOf, type Program } from '@pulse/domain'
import type { PackageVersion } from '@pulse/domain'

const SAMPLE_CATALOG = catalogOf(SAMPLE_PROGRAMS, SAMPLE_CATEGORIES, SAMPLE_BUNDLES)

function version(overrides: Partial<PackageVersion>): PackageVersion {
  return { winget: 'Example.Package', name: 'Example', version: '1.0', recommended: false, ...overrides }
}

describe('installedIds', () => {
  it('matches installed program names against catalog hints', () => {
    expect(installedIds(SAMPLE_CATALOG, ['Google Chrome', 'Some Unrelated Tool'])).toEqual(['chrome'])
  })

  it('matches a hint followed by a qualifier in parentheses', () => {
    expect(installedIds(SAMPLE_CATALOG, ['Google Chrome (64-bit)'])).toEqual(['chrome'])
  })

  it('picks the longest matching hint when a shorter one is also a prefix', () => {
    expect(installedIds(SAMPLE_CATALOG, ['Claude Code'])).toEqual(['claudecode'])
  })

  it('does not match unrelated program names', () => {
    expect(installedIds(SAMPLE_CATALOG, ['Editor de Texto da Vovó'])).toEqual([])
  })
})

describe('filterCatalog', () => {
  it('returns the full catalog for an empty term', () => {
    expect(filterCatalog(SAMPLE_CATALOG, '   ').length).toBe(SAMPLE_PROGRAMS.length)
  })

  it('matches by category name regardless of accents/case', () => {
    expect(filterCatalog(SAMPLE_CATALOG, 'midia').some((p) => p.id === 'discord')).toBe(true)
  })
})

describe('bundleIsActive', () => {
  it('is active only when selection matches exactly', () => {
    const essential = SAMPLE_BUNDLES.find((b) => b.name === 'Essencial')!
    expect(bundleIsActive(essential, new Set(essential.ids))).toBe(true)
    expect(bundleIsActive(essential, new Set([...essential.ids, 'vscode']))).toBe(false)
  })
})

describe('totalSizeMb', () => {
  it('sums known program sizes and ignores unknown ids', () => {
    const chrome = SAMPLE_CATALOG.byId.get('chrome')?.mb ?? 0
    expect(chrome).toBeGreaterThan(0)
    expect(totalSizeMb(SAMPLE_CATALOG, ['chrome', 'unknown-id'])).toBe(chrome)
  })

  it('soma mais de um, e lista vazia dá zero', () => {
    const dois = ['chrome', 'steam']
    const esperado = dois.reduce((total, id) => total + (SAMPLE_CATALOG.byId.get(id)?.mb ?? 0), 0)
    expect(totalSizeMb(SAMPLE_CATALOG, dois)).toBe(esperado)
    expect(totalSizeMb(SAMPLE_CATALOG, [])).toBe(0)
  })
})

describe('compareVersions', () => {
  it('always ranks an .LTS winget id above a numbered one', () => {
    const lts = version({ winget: 'OpenJS.NodeJS.LTS', version: '22 LTS' })
    const numbered = version({ winget: 'OpenJS.NodeJS.24', version: '24' })
    expect(compareVersions(lts, numbered)).toBeGreaterThan(0)
  })

  it('compares numbers extracted from the winget id', () => {
    const newer = version({ winget: 'EclipseAdoptium.Temurin.21.JDK' })
    const older = version({ winget: 'EclipseAdoptium.Temurin.17.JDK' })
    expect(compareVersions(newer, older)).toBeGreaterThan(0)
  })

  it('falls back to the version string when the winget id has no digits', () => {
    const older = version({ winget: 'Vendor.Package', version: '2.5' })
    const newer = version({ winget: 'Vendor.Package', version: '2.10' })
    expect(compareVersions(older, newer)).toBeLessThan(0)
  })
})

describe('meus programas', () => {
  const meu: Program = {
    id: 'meu-app',
    name: 'Meu App',
    winget: 'Alguem.MeuApp',
    version: '1.0',
    mb: 12,
    category: 'dev',
    hints: ['meu app'],
  }

  it('entram no catálogo depois do publicado', () => {
    const found = withExtras(SAMPLE_CATALOG, [meu])
    expect(found.byId.get('meu-app')?.name).toBe('Meu App')
    expect(found.programs.length).toBe(SAMPLE_CATALOG.programs.length + 1)
  })

  it('id que já existe no publicado é descartado', () => {
    const sequestro: Program = { ...meu, id: 'chrome', name: 'Não é o Chrome' }
    const found = withExtras(SAMPLE_CATALOG, [sequestro])

    expect(found.byId.get('chrome')?.name).toBe('Google Chrome')
    expect(found.programs.length).toBe(SAMPLE_CATALOG.programs.length)
  })

  it('sem nada adicionado, o catálogo é o mesmo objeto', () => {
    expect(withExtras(SAMPLE_CATALOG, [])).toBe(SAMPLE_CATALOG)
  })

  it('adotado ganha a categoria MEUS PROGRAMAS, e ela aparece agrupada', () => {
    const adotado: Program = { ...meu, category: 'mine' }
    const found = withExtras(SAMPLE_CATALOG, [adotado])

    expect(found.categories.map((c) => c.id)).toContain('mine')

    const groups = groupByCategory(found, found.programs)
    const mine = groups.find((g) => g.category.id === 'mine')
    expect(mine?.programs.map((p) => p.id)).toEqual(['meu-app'])
  })

  it('adotado em categoria publicada não inventa categoria nova', () => {
    const found = withExtras(SAMPLE_CATALOG, [meu])
    expect(found.categories.map((c) => c.id)).not.toContain('mine')
    expect(found.categories).toEqual(SAMPLE_CATALOG.categories)
  })
})
