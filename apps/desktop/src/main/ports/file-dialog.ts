export interface SaveRequest {
  suggestedName: string
  filterName: string
  extension: string
  contents: string
}

export type SaveOutcome = 'saved' | 'canceled' | 'failed'

export interface OpenedFile {
  path: string
  contents: string
}

// Quem abre janela é o Electron. A application só pede para guardar um texto ou
// para ler um que a pessoa escolheu.
export interface FileDialog {
  save(request: SaveRequest): Promise<{ outcome: SaveOutcome; path?: string }>
  openText(filterName: string, extensions: readonly string[]): Promise<OpenedFile | null>
}
