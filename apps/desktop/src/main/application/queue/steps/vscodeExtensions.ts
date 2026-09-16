import { runnerFor, type StepResult } from './context'

export const vscodeExtensions = runnerFor<string[]>(async (extensions, ctx) => {
  const result: StepResult = { extensions: 0, extensionsRequested: extensions.length }
  if (extensions.length === 0) return result

  const code = await ctx.ports.toolchain.locate('vscode')
  if (!code) {
    ctx.note(
      `${ctx.program.name}: não encontrei o comando do VS Code, as extensões ficaram de fora`,
      'error',
    )
    return result
  }

  let done = 0
  for (const [index, extension] of extensions.entries()) {
    ctx.say(`Instalando extensões (${index + 1}/${extensions.length})`)
    const ok = await ctx.ports.toolchain.run(code, ['--install-extension', extension, '--force'])
    if (ok) {
      done++
      result.extensions = done
    } else {
      ctx.note(`${ctx.program.name}: não deu para instalar a extensão ${extension}`, 'error')
    }
  }

  ctx.note(`${ctx.program.name}: ${done} de ${extensions.length} extensões instaladas`, 'ok')
  return result
})
