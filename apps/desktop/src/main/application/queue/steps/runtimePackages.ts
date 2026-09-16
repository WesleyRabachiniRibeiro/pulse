import { installArgsFor, knownPackages, runtimeToolsFor } from '@pulse/domain'
import { runnerFor } from './context'

export const runtimePackages = runnerFor<string[]>(async (chosen, ctx) => {
  const wanted = knownPackages(ctx.program.id, chosen)
  const tools = runtimeToolsFor(ctx.program.id)
  if (wanted.length === 0 || !tools) return {}

  ctx.say(`Instalando ${wanted.length} ${wanted.length === 1 ? 'ferramenta' : 'ferramentas'}`)

  const exe = await ctx.ports.toolchain.locate(tools.runner === 'npm' ? 'npm' : 'python')

  if (!exe) {
    const name = tools.runner === 'npm' ? 'npm' : 'python'
    ctx.note(
      `${ctx.program.name}: não achei o ${name}, as ferramentas ficaram para depois`,
      'error',
    )
    return { packagesFailed: wanted }
  }

  const ok = await ctx.ports.toolchain.run(exe, installArgsFor(tools.runner, wanted))

  if (ok) {
    ctx.note(`${ctx.program.name}: ${wanted.join(', ')} instalados`, 'ok')
    return { packagesInstalled: wanted }
  }

  ctx.note(`${ctx.program.name}: não deu para instalar ${wanted.join(', ')}`, 'error')
  return { packagesFailed: wanted }
})
