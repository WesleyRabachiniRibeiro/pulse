import type { RegistryEntry } from '@pulse/domain'

export interface RegistryReader {
  listEntries(): Promise<readonly RegistryEntry[]>
}
