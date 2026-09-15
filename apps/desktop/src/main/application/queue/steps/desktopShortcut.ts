import { runnerFor } from './context'

export const desktopShortcut = runnerFor<boolean>(async (wanted, ctx) => {
  ctx.say(wanted ? 'Criando o atalho na área de trabalho' : 'Tirando o atalho da área de trabalho')

  const effect = await ctx.ports.desktopShortcut.setShortcut(ctx.program, wanted)

  const message =
    effect === 'created'
      ? `${ctx.program.name}: atalho criado na área de trabalho`
      : effect === 'removed'
        ? `${ctx.program.name}: atalho tirado da área de trabalho`
        : effect === 'already'
          ? `${ctx.program.name}: o atalho já estava lá`
          : wanted
            ? `${ctx.program.name}: não aparece no menu Iniciar, não há atalho para copiar`
            : `${ctx.program.name}: não havia atalho na área de trabalho`

  ctx.note(message, effect === 'created' || effect === 'removed' ? 'ok' : 'info')

  return { desktopShortcut: effect }
})
