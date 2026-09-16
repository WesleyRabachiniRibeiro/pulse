export type SshKeyResult = 'created' | 'already' | 'failed'

export interface SshKeys {
  ensure(email: string): Promise<SshKeyResult>
}
