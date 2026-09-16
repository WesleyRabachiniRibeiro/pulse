import type { StartupEntry } from '@pulse/domain'

export interface StartupEntries {
  list(): Promise<readonly StartupEntry[]>
  set(name: string, on: boolean): Promise<void>
}
