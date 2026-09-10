import { applyEditorTweaks, type EditorResult } from '../editor'
import { runnerFor } from './context'

export const editorTweaks = runnerFor<string[]>(async (tweaks, ctx) => {
  if (tweaks.length === 0) return {}

  ctx.say('Gravando os ajustes do editor')

  const written = await applyEditorTweaks(ctx.program.id, tweaks).catch(
    (): EditorResult => 'failed',
  )
  ctx.merge({ editor: written })

  const said: Record<EditorResult, string> = {
    written: `${ctx.program.name}: ${tweaks.length} ajustes gravados no settings.json`,
    nothing: `${ctx.program.name}: nenhum ajuste do editor para gravar`,
    unreadable: `${ctx.program.name}: o settings.json tem comentário ou está fora do formato, deixei como estava`,
    failed: `${ctx.program.name}: não deu para gravar o settings.json`,
  }
  ctx.note(said[written], written === 'written' ? 'ok' : 'error')

  return { editor: written }
})
