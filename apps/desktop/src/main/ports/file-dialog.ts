export interface SaveRequest {
  suggestedName: string
  filterName: string
  extension: string
  contents: string

  startIn?: string
}

export type SaveOutcome = 'saved' | 'canceled' | 'failed'

export interface OpenedFile {
  path: string
  contents: string
}

export interface FileDialog {
  save(request: SaveRequest): Promise<{ outcome: SaveOutcome; path?: string }>
  openText(
    filterName: string,
    extensions: readonly string[],
    startIn?: string,
  ): Promise<OpenedFile | null>
  pickFolder(): Promise<string | null>
}
