import { DEFAULT_GIT, type GitConfig } from '@pulse/domain'
import type { ProcessRunner } from '../../ports/process-runner'

export class ReadGitConfig {
  constructor(private readonly processRunner: ProcessRunner) {}

  async run(): Promise<GitConfig> {
    const exe = await this.processRunner.locateGit()
    if (!exe) return DEFAULT_GIT

    const read = (key: string): Promise<string> =>
      this.processRunner.runOnce(exe, ['config', '--global', '--get', key]).then((r) => r.text.trim())

    const [name, email, branch, helper] = await Promise.all([
      read('user.name'),
      read('user.email'),
      read('init.defaultBranch'),
      read('credential.helper'),
    ])

    return {
      name,
      email,
      branch: branch || DEFAULT_GIT.branch,
      saveLogin: helper.length > 0,
    }
  }
}
