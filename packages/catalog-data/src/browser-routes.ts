export interface BrowserImportRoute {
  file: RegExp
  wizardArg?: string
  address?: string
}

export const BROWSER_IMPORT_ROUTES: readonly BrowserImportRoute[] = [
  { file: /^firefox$/i, wizardArg: '-migration' },
  { file: /^chrome$/i, address: 'chrome://settings/importData' },
  { file: /^brave$/i, address: 'brave://settings/importData' },
  { file: /^opera(\b|_)/i, address: 'opera://settings/importData' },
  { file: /^msedge$/i, address: 'edge://settings/profiles/importBrowsingData' },
  { file: /^vivaldi$/i, address: 'vivaldi://settings/importData' },
]
