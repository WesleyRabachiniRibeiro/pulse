export interface InstallProgress {
  phase?: 'downloading' | 'installing'
  percent?: number
}

export interface InstallSpec {
  itemId: string
  packageId: string
  name: string
  drive: string
  fromStore: boolean
  destination?: string
  override?: string
  scope?: 'user' | 'machine'
  locale?: string
  interactive?: boolean
}

export type InstallFailureKind =
  | 'drive-refused'
  | 'installer-busy'
  | 'needs-admin'
  | 'refused-by-user'
  | 'failed'

// Toda falha carrega mensagem pronta e código, mesmo as que a application vai
// tentar de novo: se as tentativas se esgotarem, é essa mensagem que a pessoa lê.
export interface InstallFailure {
  kind: InstallFailureKind
  message: string
  code: string
}

export type InstallOutcome =
  | { kind: 'ok'; needsReboot: boolean }
  | { kind: 'already-installed' }
  | InstallFailure

export type UninstallOutcome =
  | { kind: 'ok' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'not-managed' }
  | { kind: 'failed'; message: string; code: string }

// Devolve o desfecho já classificado, nunca código de saída nem texto de
// console. Quem implementa é o dono de todo o vocabulário do winget; a
// application só decide o que fazer com cada `kind`.
export interface PackageInstaller {
  install(spec: InstallSpec, onProgress: (progress: InstallProgress) => void): Promise<InstallOutcome>

  installElevated(spec: InstallSpec): Promise<InstallOutcome>

  uninstall(itemId: string, packageId: string, name: string): Promise<UninstallOutcome>

  cancel(itemId?: string): void
}
