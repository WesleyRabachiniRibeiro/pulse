import { homedir } from 'node:os'
import { join } from 'node:path'
import { access } from 'node:fs/promises'
import type { SshKeys, SshKeyResult } from '../../ports/ssh-keys'
import type { ProcessRunner } from '../../ports/process-runner'

// ed25519 é a escolha padrão do OpenSSH há anos: chave curta e aceita em todo
// serviço que importa. RSA só faria sentido para servidor antigo.
const KEY = 'id_ed25519'

export class NodeSshKeys implements SshKeys {
  constructor(private readonly processRunner: ProcessRunner) {}

  async ensure(email: string): Promise<SshKeyResult> {
    const path = join(homedir(), '.ssh', KEY)

    const there = await access(path)
      .then(() => true)
      .catch(() => false)

    if (there) return 'already'

    // Sem -N '' o ssh-keygen para esperando uma frase secreta que ninguém vai
    // digitar, e o processo fica pendurado até o timeout.
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
