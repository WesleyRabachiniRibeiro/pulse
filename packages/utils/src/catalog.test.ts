import { describe, expect, it } from 'vitest'
import { filterCatalog, installedIds, bundleIsActive, totalSizeMb, compareVersions } from './catalog'
import { BUNDLES } from '@pulse/catalog-data'
import { SEED_CATALOG } from '@pulse/domain'
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

  it('does not match unrelated program names', () => {
    expect(installedIds(SEED_CATALOG, ['Notepad++'])).toEqual([])
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
