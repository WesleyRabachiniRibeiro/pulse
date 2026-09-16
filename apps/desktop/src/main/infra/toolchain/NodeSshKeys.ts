import { homedir } from 'node:os'
import { join } from 'node:path'
import { access } from 'node:fs/promises'
import type { SshKeys, SshKeyResult } from '../../ports/ssh-keys'
import type { ProcessRunner } from '../../ports/process-runner'

const KEY = 'id_ed25519'

export class NodeSshKeys implements SshKeys {
  constructor(private readonly processRunner: ProcessRunner) {}

  async ensure(email: string): Promise<SshKeyResult> {
    const path = join(homedir(), '.ssh', KEY)

    const there = await access(path)
      .then(() => true)
      .catch(() => false)

    if (there) return 'already'

    const { code } = await this.processRunner
      .runOnce('ssh-keygen', ['-t', 'ed25519', '-f', path, '-N', '', '-C', email || 'pulse'])
      .catch(() => ({ code: -1, text: '' }))

    if (code !== 0) return 'failed'

    return (await access(path)
      .then(() => true)
      .catch(() => false))
      ? 'created'
      : 'failed'
  }
}
