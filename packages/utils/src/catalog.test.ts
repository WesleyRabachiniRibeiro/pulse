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
import { BUNDLES } from '@pulse/catalog-data'
import { SEED_CATALOG, type Program } from '@pulse/domain'
import type { PackageVersion } from '@pulse/domain'

function version(overrides: Partial<PackageVersion>): PackageVersion {
  return { winget: 'Example.Package', name: 'Example', version: '1.0', recommended: false, ...overrides }
}

describe('installedIds', () => {
  it('matches installed program names against catalog hints', () => {
    expect(installedIds(SEED_CATALOG, ['Google Chrome', 'Some Unrelated Tool'])).toEqual(['chrome'])
  })

  it('matches a hint followed by a qualifier in parentheses', () => {
    expect(installedIds(SEED_CATALOG, ['Google Chrome (64-bit)'])).toEqual(['chrome'])
  })

  it('picks the longest matching hint when a shorter one is also a prefix', () => {
    expect(installedIds(SEED_CATALOG, ['Claude Code'])).toEqual(['claudecode'])
  })

  // O nome é inventado de propósito: o exemplo anterior era 'Notepad++', que
  // deixou de servir no dia em que ele entrou no catálogo.
  it('does not match unrelated program names', () => {
    expect(installedIds(SEED_CATALOG, ['Editor de Texto da Vovó'])).toEqual([])
  })
})

describe('filterCatalog', () => {
  it('returns the full catalog for an empty term', () => {
    expect(filterCatalog(SEED_CATALOG, '   ').length).toBeGreaterThan(40)
  })

  it('matches by category name regardless of accents/case', () => {
    expect(filterCatalog(SEED_CATALOG, 'midia').some((p) => p.id === 'discord')).toBe(true)
  })
})

describe('bundleIsActive', () => {
  it('is active only when selection matches exactly', () => {
    const essential = BUNDLES.find((b) => b.name === 'Essencial')!
    expect(bundleIsActive(essential, new Set(essential.ids))).toBe(true)
    expect(bundleIsActive(essential, new Set([...essential.ids, 'vscode']))).toBe(false)
  })
})

describe('totalSizeMb', () => {
  it('sums known program sizes and ignores unknown ids', () => {
    expect(totalSizeMb(SEED_CATALOG, ['chrome', 'unknown-id'])).toBe(118)
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
    const found = withExtras(SEED_CATALOG, [meu])
    expect(found.byId.get('meu-app')?.name).toBe('Meu App')
    expect(found.programs.length).toBe(SEED_CATALOG.programs.length + 1)
  })

  // O publicado manda: senão um programa local sequestraria o nome de um
  // oficial, e a pessoa instalaria outra coisa sem perceber.
  it('id que já existe no publicado é descartado', () => {
    const sequestro: Program = { ...meu, id: 'chrome', name: 'Não é o Chrome' }
    const found = withExtras(SEED_CATALOG, [sequestro])

    expect(found.byId.get('chrome')?.name).toBe('Google Chrome')
    expect(found.programs.length).toBe(SEED_CATALOG.programs.length)
  })

  it('sem nada adicionado, o catálogo é o mesmo objeto', () => {
    expect(withExtras(SEED_CATALOG, [])).toBe(SEED_CATALOG)
  })

  // As telas percorrem as categorias, não os programas. Sem a categoria, o
  // adotado entraria no catálogo e mesmo assim não apareceria em lugar nenhum.
  it('adotado ganha a categoria MEUS PROGRAMAS, e ela aparece agrupada', () => {
    const adotado: Program = { ...meu, category: 'mine' }
    const found = withExtras(SEED_CATALOG, [adotado])

    expect(found.categories.map((c) => c.id)).toContain('mine')

    const groups = groupByCategory(found, found.programs)
    const mine = groups.find((g) => g.category.id === 'mine')
    expect(mine?.programs.map((p) => p.id)).toEqual(['meu-app'])
  })

  it('adotado em categoria publicada não inventa categoria nova', () => {
    const found = withExtras(SEED_CATALOG, [meu])
    expect(found.categories.map((c) => c.id)).not.toContain('mine')
    expect(found.categories).toEqual(SEED_CATALOG.categories)
  })
})
