import { DEFAULT_GIT, type GitConfig } from '@pulse/domain'
import type { Toolchain } from '../../ports/toolchain'

export class ReadGitConfig {
  constructor(private readonly toolchain: Toolchain) {}

  async run(): Promise<GitConfig> {
    const exe = await this.toolchain.locate('git')
    if (!exe) return DEFAULT_GIT

    const read = (key: string): Promise<string> =>
      this.toolchain.read(exe, ['config', '--global', '--get', key])

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
