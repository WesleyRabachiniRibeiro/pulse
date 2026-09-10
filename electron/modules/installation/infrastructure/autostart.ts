import { stdoutOr, withParams } from '@main/core/powershell'
import type { Program } from '@shared/domain/catalog'
import setAutostartScript from './powershell/SetProgramAutostart.ps1?raw'

export type AutostartResult = 'on' | 'off' | 'no-entry'

const SCRIPT_LIMIT_MS = 25_000

export async function setAutostart(program: Program, on: boolean): Promise<AutostartResult> {
  const hints = program.hints.map((hint) => hint.toLowerCase())
  const script = withParams(setAutostartScript, { Hints: hints, TurnOn: on })
  const output = await stdoutOr('', script, { timeoutMs: SCRIPT_LIMIT_MS })

  if (output.includes('no-entry')) return 'no-entry'
  if (output.includes('on')) return 'on'
  if (output.includes('off')) return 'off'
  return 'no-entry'
}
