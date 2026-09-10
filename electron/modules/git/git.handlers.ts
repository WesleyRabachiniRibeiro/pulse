import { register } from '@main/core/ipc/register'
import { readGitConfig } from './git.service'

export function registerGit(): void {
  register('git:config', () => readGitConfig())
}
