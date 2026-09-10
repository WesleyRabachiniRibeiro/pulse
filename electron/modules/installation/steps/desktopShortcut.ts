import { applyDesktopShortcut, type ShortcutResult } from '../shortcuts'
import { runnerFor } from './context'

export const desktopShortcut = runnerFor<boolean>(async (wanted, ctx) => {
  ctx.say(
    wanted ? 'Criando o atalho na área de trabalho' : 'Tirando o atalho da área de trabalho',
  )

  const shortcut = await applyDesktopShortcut(ctx.program, wanted).catch(
    (): ShortcutResult => 'failed',
  )
  ctx.merge({ shortcut })

  const said: Record<ShortcutResult, string> = {
    created: `${ctx.program.name}: atalho criado na área de trabalho`,
    removed: `${ctx.program.name}: atalho tirado da área de trabalho`,
    kept: `${ctx.program.name}: a área de trabalho já estava como você queria`,
    'not-found': `${ctx.program.name}: não achei atalho dele no menu Iniciar para copiar`,
    failed: `${ctx.program.name}: não deu para mexer no atalho`,
  }
  ctx.note(said[shortcut], shortcut === 'failed' || shortcut === 'not-found' ? 'error' : 'ok')

  return { shortcut }
})
