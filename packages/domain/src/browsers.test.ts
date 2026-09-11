import { describe, expect, it } from 'vitest'
import { browserFileName, browserImportRoute } from './browsers'

describe('browserFileName', () => {
  it('strips the folder path and the .exe extension', () => {
    expect(browserFileName('C:\\Program Files\\Mozilla Firefox\\firefox.exe')).toBe('firefox')
  })

  it('accepts forward slashes too', () => {
    expect(browserFileName('/usr/bin/opera')).toBe('opera')
  })
})

describe('browserImportRoute', () => {
  it('gives firefox a wizard argument instead of a settings address', () => {
    const route = browserImportRoute('C:\\Mozilla Firefox\\firefox.exe')
    expect(route?.wizardArg).toBe('-migration')
    expect(route?.address).toBeUndefined()
  })

  it('gives chromium-based browsers a settings address', () => {
    const route = browserImportRoute('C:\\Google\\Chrome\\Application\\chrome.exe')
    expect(route?.address).toBe('chrome://settings/importData')
  })

  it('matches opera with a profile suffix like opera_gx', () => {
    expect(browserImportRoute('opera_gx.exe')?.address).toBe('opera://settings/importData')
  })

  it('returns null for a browser with no known import route', () => {
    expect(browserImportRoute('C:\\Tor Browser\\firefox.exe')).not.toBeNull()
    expect(browserImportRoute('C:\\SomeBrowser\\unknown.exe')).toBeNull()
  })
})
