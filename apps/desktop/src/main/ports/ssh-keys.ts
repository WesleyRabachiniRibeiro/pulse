export type SshKeyResult = 'created' | 'already' | 'failed'

export interface SshKeys {
  // Nunca sobrescreve: uma chave existente é a identidade da pessoa em todo
  // serviço onde ela já cadastrou a pública.
  ensure(email: string): Promise<SshKeyResult>
}
