import { locateVsCode, runTool } from '../../toolchain'
import { runnerFor } from './context'

export const vscodeExtensions = runnerFor<string[]>(async (extensions, ctx) => {
  if (extensions.length === 0) return {}

  const code = await locateVsCode()
  if (!code) {
    ctx.note(
      `${ctx.program.name}: não encontrei o comando do VS Code, as extensões ficaram de fora`,
      'error',
    )
    return {}
  }

  let done = 0
  for (const extension of extensions) {
    ctx.say(`Instalando extensões (${done + 1}/${extensions.length})`)
    const ok = await runTool(code, ['--install-extension', extension, '--force'])
    if (ok) {
      done++
      ctx.merge({ extensions: done })
    } else {
      ctx.note(`${ctx.program.name}: não deu para instalar a extensão ${extension}`, 'error')
    }
  }

  ctx.note(`${ctx.program.name}: ${done} de ${extensions.length} extensões instaladas`, 'ok')
  return { extensions: done }
})
