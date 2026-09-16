import { BROWSER_IMPORT_ROUTES, type BrowserImportRoute } from '@pulse/catalog-data'

export type { BrowserImportRoute } from '@pulse/catalog-data'

export function browserFileName(exe: string): string {
  const cut = Math.max(exe.lastIndexOf('\\'), exe.lastIndexOf('/'))
  return exe.slice(cut + 1).replace(/\.exe$/i, '')
}

export function browserImportRoute(exe: string): BrowserImportRoute | null {
  const name = browserFileName(exe)
  return BROWSER_IMPORT_ROUTES.find((r) => r.file.test(name)) ?? null
}
