import { register } from '../../ipc/register'
import { readGitConfig } from './git.service'

export function registerGit(): void {
  register('git:config', () => readGitConfig())
}
