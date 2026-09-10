import { stdoutOr } from '@main/core/powershell'
import steamDialogScript from './powershell/IsSteamDialogOpen.ps1?raw'

const SCRIPT_LIMIT_MS = 25_000

export async function steamDialogOpen(): Promise<boolean> {
  const output = await stdoutOr('', steamDialogScript, { timeoutMs: SCRIPT_LIMIT_MS })
  return output.includes('open')
}
