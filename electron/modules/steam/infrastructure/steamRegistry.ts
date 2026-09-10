import { textOr } from '@main/core/powershell'
import steamPathScript from './powershell/GetSteamPath.ps1?raw'
import activeUserScript from './powershell/GetActiveSteamUser.ps1?raw'

const LOOKUP_TIMEOUT_MS = 15_000

export async function readSteamPath(): Promise<string | null> {
  const found = await textOr('', steamPathScript, { timeoutMs: LOOKUP_TIMEOUT_MS })
  const path = found.replace(/\//g, '\\')
  return path ? path : null
}

export async function readActiveUser(): Promise<string | null> {
  const raw = await textOr('0', activeUserScript, { timeoutMs: LOOKUP_TIMEOUT_MS })
  const account = Number(raw)
  return Number.isFinite(account) && account !== 0 ? String(account) : null
}
