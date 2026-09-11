export type AutostartDisplayState = 'on' | 'off'

export interface AutostartEntry {
  id: string
  state: AutostartDisplayState
}

// Leitura para exibir estado de autostart na tela do catálogo — não confundir
// com AutostartRegistry.setAutostart, que é a escrita usada pela fila.
export interface AutostartReader {
  list(): Promise<AutostartEntry[]>
}
