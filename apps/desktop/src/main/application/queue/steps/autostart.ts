import { runnerFor } from './context'

export const autostart = runnerFor<boolean>(async (wanted, ctx) => {
  ctx.say(wanted ? 'Deixando abrir com o Windows' : 'Tirando da inicialização do Windows')

  const effect = await ctx.ports.autostartRegistry.setAutostart(ctx.program, wanted)

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
