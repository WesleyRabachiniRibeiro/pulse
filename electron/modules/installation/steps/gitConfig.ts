import { clipboard } from 'electron'
import { gitConfigPairs, gitIsEmpty, type GitConfig } from '@shared/domain/git'
import { locateGit, runTool } from '../../toolchain'
import { ensureSshKey, type SshOutcome, type SshResult } from '../ssh'
import { runnerFor, type StepContext, type StepResult } from './context'

async function writeConfig(git: GitConfig, ctx: StepContext): Promise<StepResult> {
  ctx.say('Configurando o Git')

  const gitExe = await locateGit()
  if (!gitExe) {
    ctx.note(`${ctx.program.name}: não encontrei o git, a configuração ficou para depois`, 'error')
    return {}
  }

  const found: StepResult = {}

  for (const [key, value] of gitConfigPairs(git)) {
    const ok = await runTool(gitExe, ['config', '--global', key, value])
    if (!ok) {
      ctx.note(`${ctx.program.name}: falhou ao gravar ${key}`, 'error')
      continue
    }
    if (key === 'credential.helper') found.gitLogin = true
    else found.git = true
  }

  ctx.merge(found)

  if (git.saveLogin) {
    ctx.note(
      found.gitLogin
        ? `${ctx.program.name}: o Windows vai guardar o login do GitHub`
        : `${ctx.program.name}: falhou ao ligar o gerenciador de credenciais`,
      found.gitLogin ? 'ok' : 'error',
    )
  }

  ctx.note(`${ctx.program.name}: Git configurado`, 'ok')
  return found
}

async function writeSshKey(email: string, ctx: StepContext): Promise<StepResult> {
  ctx.say('Cuidando da chave SSH')

  const outcome = await ensureSshKey(email).catch(
    (): SshOutcome => ({ result: 'failed', publicKey: null }),
  )

  const found: StepResult = { sshKey: outcome.result }

  if (outcome.publicKey) {
    clipboard.writeText(outcome.publicKey)
    found.sshCopied = true
  }
  ctx.merge(found)

  const said: Record<SshResult, string> = {
    created: `${ctx.program.name}: chave SSH criada, a parte pública já está na área de transferência`,
    existed: `${ctx.program.name}: você já tinha uma chave SSH, não criei outra`,
    'no-tool': `${ctx.program.name}: não achei o ssh-keygen para criar a chave`,
    failed: `${ctx.program.name}: não deu para criar a chave SSH`,
  }
  ctx.note(said[outcome.result], outcome.result === 'created' ? 'ok' : 'info')

  return found
}

export const gitConfig = runnerFor<GitConfig>(async (git, ctx) => {
  const found: StepResult = {}

  if (!gitIsEmpty(git)) Object.assign(found, await writeConfig(git, ctx))
  if (git.sshKey) Object.assign(found, await writeSshKey(git.email, ctx))

  return found
})
