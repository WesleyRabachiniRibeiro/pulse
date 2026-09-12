import type { StartupEntry } from '@pulse/domain'

// Entradas de inicialização do Windows por nome, todas elas. Não confundir com
// AutostartRegistry, que liga e desliga o autostart de um programa do catálogo
// durante a fila.
export interface StartupEntries {
  list(): Promise<readonly StartupEntry[]>
  set(name: string, on: boolean): Promise<void>
}
