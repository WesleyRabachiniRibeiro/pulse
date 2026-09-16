export type AutostartDisplayState = 'on' | 'off'

export interface AutostartEntry {
  id: string
  state: AutostartDisplayState
}

export interface AutostartReader {
  list(): Promise<AutostartEntry[]>
}
