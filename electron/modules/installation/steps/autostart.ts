import { stdoutOr, withParams } from '@main/core/powershell'
import type { Program } from '@shared/domain/catalog'
import setAutostartScript from '../infrastructure/powershell/SetProgramAutostart.ps1?raw'
import { runnerFor } from './context'

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

export const autostart = runnerFor<boolean>(async (wanted, ctx) => {
  ctx.say(wanted ? 'Deixando abrir com o Windows' : 'Tirando da inicialização do Windows')

  const effect = await setAutostart(ctx.program, wanted)
  ctx.merge({ autostart: effect })

  ctx.note(
    effect === 'no-entry'
      ? `${ctx.program.name}: não se cadastra para abrir sozinho, nada a mudar`
      : effect === 'on'
        ? `${ctx.program.name}: passa a abrir com o Windows`
        : `${ctx.program.name}: não abre mais sozinho`,
    effect === 'no-entry' ? 'info' : 'ok',
  )

  return { autostart: effect }
})
