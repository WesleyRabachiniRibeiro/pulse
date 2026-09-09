import { homedir } from 'node:os'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { runTool } from './tools'

export type SshResult = 'created' | 'existed' | 'no-tool' | 'failed'

export interface SshOutcome {
  result: SshResult
  publicKey: string | null
}

const KEY_NAME = 'id_ed25519'

function sshFolder(): string {
  return join(homedir(), '.ssh')
}

function privateKeyPath(): string {
  return join(sshFolder(), KEY_NAME)
}

function publicKeyPath(): string {
  return `${privateKeyPath()}.pub`
}

async function exists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false)
}

async function readPublicKey(): Promise<string | null> {
  const raw = await readFile(publicKeyPath(), 'utf8').catch(() => null)
  return raw?.trim() || null
}

export async function ensureSshKey(email: string): Promise<SshOutcome> {
  if (await exists(privateKeyPath())) {
    return { result: 'existed', publicKey: await readPublicKey() }
  }

  const tool = await locateSshKeygen()
  if (!tool) return { result: 'no-tool', publicKey: null }

  try {
    await mkdir(sshFolder(), { recursive: true })
  } catch {
    return { result: 'failed', publicKey: null }
  }

  const comment = email.trim() || 'pulse'
  const ok = await runTool(tool, [
    '-t',
    'ed25519',
    '-C',
    comment,
    '-f',
    privateKeyPath(),
    '-N',
    '',
  ])

  if (!ok || !(await exists(privateKeyPath()))) return { result: 'failed', publicKey: null }

  return { result: 'created', publicKey: await readPublicKey() }
}

async function locateSshKeygen(): Promise<string | null> {
  const candidates = [
    join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'OpenSSH', 'ssh-keygen.exe'),
    join(process.env['ProgramFiles'] ?? '', 'Git', 'usr', 'bin', 'ssh-keygen.exe'),
  ]

  for (const candidate of candidates) {
    if (candidate && (await exists(candidate))) return candidate
  }

  return null
}
