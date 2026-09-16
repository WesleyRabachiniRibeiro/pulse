import { describe, expect, it } from 'vitest'
import { parseAcfField, parseAppsSection, parseLibraryFolderPaths } from './textVdf'

describe('parseLibraryFolderPaths', () => {
  it('extracts every "path" entry and unescapes doubled backslashes', () => {
    const vdf = `
"libraryfolders"
{
  "0"
  {
    "path"		"C:\\\\Program Files (x86)\\\\Steam"
  }
  "1"
  {
    "path"		"D:\\\\SteamLibrary"
  }
}`
    expect(parseLibraryFolderPaths(vdf)).toEqual([
      'C:\\Program Files (x86)\\Steam',
      'D:\\SteamLibrary',
    ])
  })

  it('returns an empty array when there is no path key', () => {
    expect(parseLibraryFolderPaths('{}')).toEqual([])
  })
})

describe('parseAcfField', () => {
  const acf = `
"AppState"
{
  "appid"		"570"
  "name"		"Dota 2"
  "SizeOnDisk"		"37580328335"
}`

  it('reads a known field', () => {
    expect(parseAcfField(acf, 'appid')).toBe('570')
    expect(parseAcfField(acf, 'name')).toBe('Dota 2')
    expect(parseAcfField(acf, 'SizeOnDisk')).toBe('37580328335')
  })

  it('returns undefined for a field that is not present', () => {
    expect(parseAcfField(acf, 'missing')).toBeUndefined()
  })
})

describe('parseAppsSection', () => {
  it('collects the numeric app ids under the largest "apps" block', () => {
    const localconfig = `
"UserLocalConfigStore"
{
  "Software"
  {
    "valve"
    {
      "Steam"
      {
        "apps"
        {
          "570"
          {
            "some" "value"
          }
          "730"
          {
          }
        }
      }
    }
  }
}`
    expect(parseAppsSection(localconfig)).toEqual(new Set(['570', '730']))
  })

  it('returns an empty set when there is no apps section', () => {
    expect(parseAppsSection('{}').size).toBe(0)
  })
})
