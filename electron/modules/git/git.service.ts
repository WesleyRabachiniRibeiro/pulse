import { spawn } from 'node:child_process'
import { DEFAULT_GIT, lineEndingSchema, type GitConfig } from '@shared/domain/git'
import { locateGit } from '../tools'

function ler(exe: string, chave: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(exe, ['config', '--global', '--get', chave], { windowsHide: true })
    let saida = ''
    child.stdout?.on('data', (b: Buffer) => (saida += b.toString('utf8')))
    child.on('error', () => resolve(''))
    child.on('close', () => resolve(saida.trim()))
  })
}

export async function readGitConfig(): Promise<GitConfig> {
  const exe = await locateGit()
  if (!exe) return DEFAULT_GIT

  const [name, email, branch, helper, autocrlf, rebase] = await Promise.all([
    ler(exe, 'user.name'),
    ler(exe, 'user.email'),
    ler(exe, 'init.defaultBranch'),
    ler(exe, 'credential.helper'),
    ler(exe, 'core.autocrlf'),
    ler(exe, 'pull.rebase'),
  ])

  const parsedEnding = lineEndingSchema.safeParse(autocrlf.toLowerCase())

  return {
    name,
    email,
    branch: branch || DEFAULT_GIT.branch,
    saveLogin: helper.length > 0,
    ...(parsedEnding.success ? { lineEnding: parsedEnding.data } : {}),
    ...(rebase ? { pullRebase: rebase.toLowerCase() === 'true' } : {}),
  }
}
