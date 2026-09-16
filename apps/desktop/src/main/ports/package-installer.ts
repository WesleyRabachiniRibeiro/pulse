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

export interface PackageInstaller {
  install(spec: InstallSpec, onProgress: (progress: InstallProgress) => void): Promise<InstallOutcome>

  installElevated(spec: InstallSpec): Promise<InstallOutcome>

  uninstall(itemId: string, packageId: string, name: string): Promise<UninstallOutcome>

  cancel(itemId?: string): void
}
