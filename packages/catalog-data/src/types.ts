export type CategoryId = 'browsers' | 'games' | 'media' | 'dev'

export interface Category {
  id: CategoryId
  name: string
}

export type SettingsKind = 'vscode' | 'steam' | 'git' | 'tibia' | 'riot' | 'vs' | 'browser'

export interface Program {
  id: string
  name: string
  winget?: string
  source?: 'msstore' | 'pages'
  version: string
  mb: number
  category: CategoryId
  hints: readonly string[]
  notice?: string
  settingsKind?: SettingsKind
  // Declara os ajustes por id. Quem usa isto dispensa settingsKind, que é o
  // atalho de quando um programa tinha exatamente um tipo de ajuste.
  steps?: readonly string[]
  family?: {
    prefix: string
    pattern: string
  }
}

export interface Bundle {
  name: string
  ids: readonly string[]
}

export interface SettingsOption {
  id: string
  name: string
  hint: string
  category: string
  url?: string
}
