import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isRealGame, type SteamGame, type SteamLibrary } from '@pulse/domain'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { SteamGameRequester } from '../../ports/steam-game-requester'
import type { SteamLibraryReader } from '../../ports/steam-library-reader'
import { readKnownApps, readLicenses } from './vdf'
import { parseAcfField, parseAppsSection, parseLibraryFolderPaths } from './textVdf'

const SCRIPT_TIMEOUT_MS = 15_000
const SEARCH_TIMEOUT_MS = 8_000

export class SteamAdapter implements SteamGameRequester, SteamLibraryReader {
  constructor(private readonly powershell: PowerShellRunner) {}

  async isSignedIn(): Promise<boolean> {
    return (await this.activeUser()) !== null
  }

  async isInstallDialogOpen(): Promise<boolean> {
    const { open } = await this.powershell.runJson<{ open: boolean }>(
      'Test-SteamInstallDialog.ps1',
      undefined,
      SCRIPT_TIMEOUT_MS,
    )
    return open
  }

  async hasManifest(appid: string): Promise<boolean> {
    const steam = await this.steamPath()
    if (!steam) return false

    const folders = await this.libraryFolders(steam)
    for (const folder of folders) {
      try {
        await readFile(join(folder, 'steamapps', `appmanifest_${appid}.acf`))
        return true
      } catch {
        continue
      }
    }
    return false
  }

  async readLibrary(): Promise<SteamLibrary> {
    const steam = await this.steamPath()
    if (!steam) return { hasSteam: false, installed: [], owned: [] }

    const folders = await this.libraryFolders(steam)
    const lists = await Promise.all(folders.map((folder) => this.gamesInFolder(folder)))

    const byAppid = new Map<string, SteamGame>()
    for (const game of lists.flat()) if (!byAppid.has(game.appid)) byAppid.set(game.appid, game)

    const installed = [...byAppid.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    )

    const fromAccount = await this.accountGames(steam)
    const strangers = await this.otherAccountGames(steam)
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

  async search(term: string): Promise<SteamGame[]> {
    const url = `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(term)}`
    const control = new AbortController()
    const limit = setTimeout(() => control.abort(), SEARCH_TIMEOUT_MS)

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

  private async steamPath(): Promise<string | null> {
    try {
      const { path } = await this.powershell.runJson<{ path: string | null }>(
        'Get-SteamPath.ps1',
        undefined,
        SCRIPT_TIMEOUT_MS,
      )
      return path
    } catch {
      return null
    }
  }

  private async activeUser(): Promise<string | null> {
    try {
      const { userId } = await this.powershell.runJson<{ userId: string | null }>(
        'Get-SteamActiveUser.ps1',
        undefined,
        SCRIPT_TIMEOUT_MS,
      )
      return userId
    } catch {
      return null
    }
  }

  private async libraryFolders(steam: string): Promise<string[]> {
    const byKey = new Map<string, string>()
    const keep = (path: string): void => {
      byKey.set(path.replace(/[\\/]+$/, '').toLowerCase(), path)
    }

    keep(steam)
    try {
      const vdf = await readFile(join(steam, 'steamapps', 'libraryfolders.vdf'), 'utf8')
      for (const path of parseLibraryFolderPaths(vdf)) keep(path)
    } catch {
      // sem libraryfolders.vdf, sobra só a instalação principal
    }
    return [...byKey.values()]
  }

  private async gamesInFolder(folder: string): Promise<SteamGame[]> {
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
        const appid = parseAcfField(text, 'appid')
        const name = parseAcfField(text, 'name')
        if (!appid || !name || !isRealGame(name)) continue

        const bytes = Number(parseAcfField(text, 'SizeOnDisk') ?? '0')
        games.push({
          appid,
          name,
          ...(bytes > 0 ? { bytes } : {}),
          drive: folder.slice(0, 2).toUpperCase(),
        })
      } catch {
        continue
      }
    }
    return games
  }

  private async accountGames(steam: string): Promise<SteamGame[]> {
    const cache = join(steam, 'appcache')

    const [apps, licenses] = await Promise.all([
      readKnownApps(join(cache, 'appinfo.vdf')).catch(() => new Map()),
      readLicenses(join(cache, 'packageinfo.vdf')).catch(() => new Set<string>()),
    ])

    const games: SteamGame[] = []
    for (const appid of licenses) {
      const app = apps.get(appid)
      if (!app || app.type !== 'game' || !isRealGame(app.name)) continue
      games.push({ appid, name: app.name })
    }

    return games.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
  }

  private async appsOf(steam: string, userId: string): Promise<Set<string>> {
    const text = await readFile(
      join(steam, 'userdata', userId, 'config', 'localconfig.vdf'),
      'utf8',
    ).catch(() => '')

    return parseAppsSection(text)
  }

  private async otherAccountGames(steam: string): Promise<Set<string>> {
    const active = await this.activeUser()
    if (!active) return new Set()

    const users = await readdir(join(steam, 'userdata')).catch((): string[] => [])
    const mine = await this.appsOf(steam, active)
    const theirs = new Set<string>()

    for (const user of users) {
      if (user === active || !/^\d+$/.test(user)) continue
      for (const appid of await this.appsOf(steam, user)) {
        if (!mine.has(appid)) theirs.add(appid)
      }
    }

    return theirs
  }
}
