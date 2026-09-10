import { run } from '@main/core/powershell'
import refreshExplorerScript from './powershell/RefreshExplorer.ps1?raw'

const CALL_TIMEOUT_MS = 10_000

export async function refreshExplorer(): Promise<void> {
  await run(refreshExplorerScript, { timeoutMs: CALL_TIMEOUT_MS }).catch(() => undefined)
}
