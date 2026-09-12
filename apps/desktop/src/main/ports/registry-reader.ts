import type { RegistryEntry } from '@pulse/domain'

// As entradas cruas do registro de desinstalação do Windows. Montar a árvore a
// partir delas é trabalho de quem consome, não deste adapter.
export interface RegistryReader {
  listEntries(): Promise<readonly RegistryEntry[]>
}
