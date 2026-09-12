import { gitConfigPairs, type GitConfig } from '@pulse/domain'
import { runnerFor, type StepResult } from './context'

export const gitConfig = runnerFor<GitConfig>(async (config, ctx) => {
  const result: StepResult = { git: false, gitLogin: false }

  const pairs = gitConfigPairs(config)
  if (pairs.length === 0) return result

  ctx.say('Configurando o Git')

  const gitExe = await ctx.ports.toolchain.locate('git')
  if (!gitExe) {
    ctx.note(`${ctx.program.name}: não encontrei o git, a configuração ficou para depois`, 'error')
    return result
  }

  for (const [key, value] of pairs) {
    const ok = await ctx.ports.toolchain.run(gitExe, ['config', '--global', key, value])

    if (key === 'credential.helper') {
      result.gitLogin = ok
      ctx.note(
        ok
          ? `${ctx.program.name}: o Windows vai guardar o login do GitHub`
          : `${ctx.program.name}: falhou ao ligar o gerenciador de credenciais`,
        ok ? 'ok' : 'error',
      )
      continue
    }

    if (ok) result.git = true
    else ctx.note(`${ctx.program.name}: falhou ao gravar ${key}`, 'error')
  }

  ctx.note(`${ctx.program.name}: Git configurado`, 'ok')
  return result
})
