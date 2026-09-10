import { jsonOr, textOr, withParams } from '@main/core/powershell'
import registeredScript from './powershell/GetRegisteredBrowsers.ps1?raw'
import defaultProgIdScript from './powershell/GetDefaultBrowserProgId.ps1?raw'
import processRunningScript from './powershell/IsProcessRunning.ps1?raw'

export interface RegisteredBrowser {
  key: string
  exe: string
  progId: string
}

const LIMIT_MS = 25_000

export async function readRegisteredBrowsers(): Promise<RegisteredBrowser[]> {
  const parsed = await jsonOr<unknown>(null, registeredScript, { timeoutMs: LIMIT_MS })
  if (parsed === null) return []
  return (Array.isArray(parsed) ? parsed : [parsed]) as RegisteredBrowser[]
}

export function readDefaultProgId(): Promise<string> {
  return textOr('', defaultProgIdScript, { timeoutMs: LIMIT_MS })
}

export async function isProcessRunning(name: string): Promise<boolean> {
  const out = await textOr(
    '',
    withParams(processRunningScript, { ProcessName: name }),
    { timeoutMs: LIMIT_MS },
  )
  return out.includes('sim')
}
