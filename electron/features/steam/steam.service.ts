import { execFile } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { SteamGame, SteamLibrary } from '@shared/domain/steam'
import { readKnownApps, readLicenses } from './vdf'

const exec = promisify(execFile)

async function steamPath(): Promise<string | null> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$p = (Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam').SteamPath
if (-not $p) { $p = (Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Valve\\Steam').InstallPath }
if ($p) { $p } else { '' }
`
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  try {
    const { stdout } = await exec(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 15_000 },
    )
    const path = stdout.trim().replace(/\//g, '\\')
    return path ? path : null
  } catch {
    return null
  }
}

async function libraryFolders(steam: string): Promise<string[]> {
  const byKey = new Map<string, string>()
  const keep = (path: string) => {
    byKey.set(path.replace(/[\\/]+$/, '').toLowerCase(), path)
  }

  keep(steam)
  try {
    const vdf = await readFile(join(steam, 'steamapps', 'libraryfolders.vdf'), 'utf8')
    for (const found of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      const path = found[1]?.replace(/\\\\/g, '\\')
      if (path) keep(path)
    }
  } catch {
  }
  return [...byKey.values()]
}

const NOT_A_GAME = /redistributable|proton|steam linux runtime|steamworks common/i

function field(text: string, key: string): string | undefined {
  return new RegExp(`"${key}"\\s+"([^"]*)"`, 'i').exec(text)?.[1]
}

async function gamesInFolder(folder: string): Promise<SteamGame[]> {
  const steamapps = join(folder, 'steamapps')
  let files: string[]
  try {
    files = await readdir(steamapps)
  } catch {
    return []
  }

  const games: SteamGame[] = []
  for (const file of files) {
    if (!file.startsWith('appmanifest_') || !file.endsWith('.acf')) continue
    try {
      const text = await readFile(join(steamapps, file), 'utf8')
      const appid = field(text, 'appid')
      const name = field(text, 'name')
      if (!appid || !name || NOT_A_GAME.test(name)) continue

      const bytes = Number(field(text, 'SizeOnDisk') ?? '0')
      games.push({
        appid,
        name,
        ...(bytes > 0 ? { bytes } : {}),
        drive: folder.slice(0, 2).toUpperCase(),
      })
    } catch {
    }
  }
  return games
}

async function accountGames(steam: string): Promise<SteamGame[]> {
  const cache = join(steam, 'appcache')

  const [apps, licenses] = await Promise.all([
    readKnownApps(join(cache, 'appinfo.vdf')).catch(() => new Map()),
    readLicenses(join(cache, 'packageinfo.vdf')).catch(() => new Set<string>()),
  ])

  const games: SteamGame[] = []
  for (const appid of licenses) {
    const app = apps.get(appid)
    if (!app || app.type !== 'game' || NOT_A_GAME.test(app.name)) continue
    games.push({ appid, name: app.name })
  }

  return games.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

export async function readLibrary(): Promise<SteamLibrary> {
  const steam = await steamPath()
  if (!steam) return { hasSteam: false, installed: [], owned: [] }

  const folders = await libraryFolders(steam)
  const lists = await Promise.all(folders.map(gamesInFolder))

  const byAppid = new Map<string, SteamGame>()
  for (const game of lists.flat()) if (!byAppid.has(game.appid)) byAppid.set(game.appid, game)

  const installed = [...byAppid.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
  )

  const fromAccount = await accountGames(steam)
  const strangers = await otherAccountGames(steam)
  const library = new Map<string, SteamGame>()
  for (const game of fromAccount) {
    if (strangers.has(game.appid) && !byAppid.has(game.appid)) continue
    library.set(game.appid, byAppid.get(game.appid) ?? game)
  }
  for (const game of installed) if (!library.has(game.appid)) library.set(game.appid, game)

  const owned = [...library.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
  )

  return { hasSteam: true, installed, owned }
}

export async function isSignedIn(): Promise<boolean> {
  return (await activeUser()) !== null
}

async function activeUser(): Promise<string | null> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$user = (Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam\\ActiveProcess' -Name ActiveUser).ActiveUser
if ($user) { [string][int]$user } else { '0' }
`
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  try {
    const { stdout } = await exec(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 15_000 },
    )
    const account = Number(stdout.trim())
    return Number.isFinite(account) && account !== 0 ? String(account) : null
  } catch {
    return null
  }
}

async function appsOf(steam: string, userId: string): Promise<Set<string>> {
  const text = await readFile(
    join(steam, 'userdata', userId, 'config', 'localconfig.vdf'),
    'utf8',
  ).catch(() => '')

  let best = new Set<string>()
  const lower = text.toLowerCase()

  for (let at = lower.indexOf('"apps"'); at >= 0; at = lower.indexOf('"apps"', at + 1)) {
    const found = new Set<string>()
    let depth = 0
    let opened = false

    for (let p = at; p < text.length; p++) {
      const c = text[p]
      if (c === '{') {
        depth++
        opened = true
      } else if (c === '}') {
        depth--
        if (opened && depth === 0) break
      } else if (c === '"' && depth === 1) {
        const end = text.indexOf('"', p + 1)
        if (end < 0) break
        const key = text.slice(p + 1, end)
        if (/^\d+$/.test(key)) found.add(key)
        p = end
      }
    }

    if (found.size > best.size) best = found
  }

  return best
}

async function otherAccountGames(steam: string): Promise<Set<string>> {
  const active = await activeUser()
  if (!active) return new Set()

  const users = await readdir(join(steam, 'userdata')).catch((): string[] => [])
  const mine = await appsOf(steam, active)
  const theirs = new Set<string>()

  for (const user of users) {
    if (user === active || !/^\d+$/.test(user)) continue
    for (const appid of await appsOf(steam, user)) {
      if (!mine.has(appid)) theirs.add(appid)
    }
  }

  return theirs
}

export async function hasManifest(appid: string): Promise<boolean> {
  const steam = await steamPath()
  if (!steam) return false

  const folders = await libraryFolders(steam)
  for (const folder of folders) {
    try {
      await readFile(join(folder, 'steamapps', `appmanifest_${appid}.acf`))
      return true
    } catch {
    }
  }
  return false
}

export async function searchSteam(term: string): Promise<SteamGame[]> {
  const url = `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(term)}`
  const control = new AbortController()
  const limit = setTimeout(() => control.abort(), 8000)

  try {
    const response = await fetch(url, { signal: control.signal })
    if (!response.ok) return []

    const raw: unknown = await response.json()
    if (!Array.isArray(raw)) return []

    return raw
      .filter(
        (g): g is { appid: string; name: string } =>
          typeof g === 'object' &&
          g !== null &&
          typeof (g as { appid?: unknown }).appid === 'string' &&
          typeof (g as { name?: unknown }).name === 'string',
      )
      .slice(0, 12)
      .map((g) => ({ appid: g.appid, name: g.name }))
  } catch {
    return []
  } finally {
    clearTimeout(limit)
  }
}
