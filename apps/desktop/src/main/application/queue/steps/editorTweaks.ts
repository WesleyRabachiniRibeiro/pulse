import type { EditorWriteResult } from '../../../ports/editor-settings-store'
import { runnerFor } from './context'

export const editorTweaks = runnerFor<string[]>(async (tweaks, ctx) => {
  if (tweaks.length === 0) return {}

  ctx.say('Gravando os ajustes do editor')

  const written = await ctx.ports.editorSettingsStore
    .apply(ctx.program.id, tweaks)
    .catch((): EditorWriteResult => 'failed')

  const said: Record<EditorWriteResult, string> = {
    written: `${ctx.program.name}: ${tweaks.length} ${tweaks.length === 1 ? 'ajuste gravado' : 'ajustes gravados'} no settings.json`,
    nothing: `${ctx.program.name}: nenhum ajuste do editor para gravar`,
    unreadable: `${ctx.program.name}: o settings.json tem comentário ou está fora do formato, deixei como estava`,
    failed: `${ctx.program.name}: não deu para gravar o settings.json`,
  }
  ctx.note(said[written], written === 'written' ? 'ok' : 'error')

  return { editor: written }
})
