export interface SaveRequest {
  suggestedName: string
  filterName: string
  extension: string
  contents: string
  // Onde a janela abre. Sem isso ela começa na última pasta do Windows, que
  // não é a que a pessoa escolheu para guardar os perfis.
  startIn?: string
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
  openText(
    filterName: string,
    extensions: readonly string[],
    startIn?: string,
  ): Promise<OpenedFile | null>
  pickFolder(): Promise<string | null>
}
